// FILE: frontend/src/opd/Triage.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { fetchQueue, recordVitals, fetchLatestVitals, fetchVitalsHistory } from '../api/opd'
import DoctorPicker from './components/DoctorPicker'
import { useAuth } from '../store/authStore'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

import {
    Activity,
    Stethoscope,
    HeartPulse,
    Thermometer,
    User2,
    Loader2,
    Search,
    RefreshCcw,
    CheckCircle2,
    AlertTriangle,
    ShieldAlert,
    History,
    Sparkles,
    X,
    Save,
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Minus,
    CalendarDays,
    Clock,
    Lock,
    Building2,
} from 'lucide-react'

/* ----------------------------- Helpers ----------------------------- */
const todayStr = () => new Date().toISOString().slice(0, 10)

const resetFormObj = {
    height_cm: '',
    weight_kg: '',
    temp_c: '',
    pulse: '',
    resp_rate: '',
    spo2: '',
    bp_sys: '',
    bp_dia: '',
    notes: '',
}

const toStr = (v) => (v === null || v === undefined ? '' : String(v))
const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const niceDT = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString()
}

function cx(...xs) { return xs.filter(Boolean).join(' ') }

function prettyDate(d) {
    if (!d) return ''
    try {
        return new Date(d).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        })
    } catch {
        return d
    }
}

function computeBMI(heightCm, weightKg) {
    const h = num(heightCm)
    const w = num(weightKg)
    if (!h || !w || h <= 0 || w <= 0) return null
    const m = h / 100
    const bmi = w / (m * m)
    if (!Number.isFinite(bmi)) return null
    return Math.round(bmi * 10) / 10
}

function bmiLabel(bmi) {
    if (bmi === null) return null
    if (bmi < 18.5) return { label: 'Underweight', tone: 'warning' }
    if (bmi < 25) return { label: 'Normal', tone: 'ok' }
    if (bmi < 30) return { label: 'Overweight', tone: 'warning' }
    return { label: 'Obese', tone: 'critical' }
}

/** UI-only heuristic badge (not clinical advice). */
function vitalsSeverity(v) {
    let level = 0
    const reasons = []

    const t = num(v.temp_c)
    const p = num(v.pulse)
    const rr = num(v.resp_rate)
    const s = num(v.spo2)
    const sbp = num(v.bp_sys)
    const dbp = num(v.bp_dia)

    if (s !== null) {
        if (s < 90) { level = Math.max(level, 2); reasons.push('Low SpO₂ (<90)') }
        else if (s < 94) { level = Math.max(level, 1); reasons.push('Borderline SpO₂ (<94)') }
    }

    if (t !== null) {
        if (t >= 40 || t < 34) { level = Math.max(level, 2); reasons.push('Temp critical') }
        else if (t >= 39 || t < 36) { level = Math.max(level, 1); reasons.push('Temp abnormal') }
    }

    if (p !== null) {
        if (p > 130 || p < 40) { level = Math.max(level, 2); reasons.push('Pulse critical') }
        else if (p > 110 || p < 50) { level = Math.max(level, 1); reasons.push('Pulse abnormal') }
    }

    if (rr !== null) {
        if (rr > 30 || rr < 8) { level = Math.max(level, 2); reasons.push('Resp rate critical') }
        else if (rr > 20 || rr < 12) { level = Math.max(level, 1); reasons.push('Resp rate abnormal') }
    }

    if (sbp !== null) {
        if (sbp < 90) { level = Math.max(level, 2); reasons.push('Low systolic BP') }
        else if (sbp < 100) { level = Math.max(level, 1); reasons.push('Borderline systolic BP') }
        else if (sbp >= 180) { level = Math.max(level, 2); reasons.push('Very high systolic BP') }
        else if (sbp >= 140) { level = Math.max(level, 1); reasons.push('High systolic BP') }
    }
    if (dbp !== null) {
        if (dbp >= 120) { level = Math.max(level, 2); reasons.push('Very high diastolic BP') }
        else if (dbp >= 90) { level = Math.max(level, 1); reasons.push('High diastolic BP') }
    }

    const label = level === 2 ? 'Critical' : level === 1 ? 'Warning' : 'Normal'
    return { level, label, reasons }
}

const TRIAGE_STATUS = [
    { key: 'active', label: 'Active' },
    { key: 'all', label: 'All' },
    { key: 'booked', label: 'Booked' },
    { key: 'checked_in', label: 'Checked-in' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'no_show', label: 'No-show' },
    { key: 'cancelled', label: 'Cancelled' },
]

function statusPill(status) {
    const base = 'rounded-full border px-2.5 py-1 text-[11px] font-semibold'
    switch (status) {
        case 'booked':
            return cx(base, 'border-slate-500 bg-slate-50 text-slate-700')
        case 'checked_in':
            return cx(base, 'border-sky-200 bg-sky-50 text-sky-800')
        case 'in_progress':
            return cx(base, 'border-amber-200 bg-amber-50 text-amber-800')
        case 'completed':
            return cx(base, 'border-emerald-200 bg-emerald-50 text-emerald-800')
        case 'no_show':
            return cx(base, 'border-rose-200 bg-rose-50 text-rose-800')
        case 'cancelled':
            return cx(base, 'border-slate-500 bg-slate-100 text-slate-600')
        default:
            return cx(base, 'border-slate-500 bg-slate-50 text-slate-700')
    }
}

/* ----------------------------- UI Tokens ----------------------------- */
const UI = {
    pageBg: 'bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.10),_transparent_55%)]',
    glass: 'rounded-3xl border border-black/50 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]',
    glassSoft: 'rounded-3xl border border-black/50 bg-white/70 backdrop-blur-xl shadow-[0_6px_22px_rgba(2,6,23,0.08)]',
    chip: 'inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700',
    chipBtn: 'inline-flex items-center gap-2 rounded-full border border-black/50 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 active:scale-[0.99] transition',
    input: 'w-full rounded-2xl border border-black/50 bg-white/85 px-3 py-2 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500',
}

/* ----------------------------- Sparkline + Trends ----------------------------- */
function safeSeries(historyAsc, pick) {
    const out = []
    for (const h of historyAsc || []) out.push(num(pick(h)))
    return out
}

function trendInfo(series) {
    const clean = (series || []).filter((x) => typeof x === 'number' && Number.isFinite(x))
    if (clean.length === 0) return { current: null, prev: null, delta: null, dir: 'flat' }
    const current = clean[clean.length - 1]
    const prev = clean.length >= 2 ? clean[clean.length - 2] : null
    const delta = prev === null ? null : (current - prev)
    const dir = delta === null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
    return { current, prev, delta, dir }
}

function formatDelta(delta, digits = 0) {
    if (delta === null || !Number.isFinite(delta)) return '—'
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
    const abs = Math.abs(delta)
    const val = digits > 0 ? abs.toFixed(digits) : String(Math.round(abs))
    return `${sign}${val}`
}

function Sparkline({ series, series2, height = 28 }) {
    const w = 120
    const h = height
    const pad = 3

    const s1 = (series || []).filter((x) => typeof x === 'number' && Number.isFinite(x))
    const s2 = (series2 || []).filter((x) => typeof x === 'number' && Number.isFinite(x))

    const all = [...s1, ...s2]
    if (all.length < 2) {
        return (
            <div className="h-[28px] w-[120px] rounded-2xl border border-black/50 bg-black/[0.02] grid place-items-center">
                <Minus className="h-4 w-4 text-slate-400" />
            </div>
        )
    }

    const min = Math.min(...all)
    const max = Math.max(...all)
    const span = max - min || 1

    const buildPath = (arr) => {
        if (!arr || arr.length < 2) return ''
        const n = arr.length
        const step = (w - pad * 2) / (n - 1)
        return arr
            .map((v, i) => {
                const x = pad + i * step
                const y = pad + (h - pad * 2) * (1 - (v - min) / span)
                return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
            })
            .join(' ')
    }

    const p1 = buildPath(s1)
    const p2 = buildPath(s2)

    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="rounded-2xl border border-black/50 bg-white/85" aria-hidden="true">
            <path d={`M ${pad} ${h - pad} L ${w - pad} ${h - pad}`} stroke="currentColor" opacity="0.10" strokeWidth="1" />
            {p2 ? <path d={p2} fill="none" stroke="currentColor" opacity="0.35" strokeWidth="2" strokeLinecap="round" /> : null}
            {p1 ? <path d={p1} fill="none" stroke="currentColor" opacity="0.75" strokeWidth="2.2" strokeLinecap="round" /> : null}
        </svg>
    )
}

function TrendChip({ dir, deltaText }) {
    const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus
    const cls =
        dir === 'up'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : dir === 'down'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-black/50 bg-black/[0.02] text-slate-700'

    return (
        <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold', cls)}>
            <Icon className="h-4 w-4" />
            {deltaText}
        </span>
    )
}

function TrendTile({ title, value, unit, dir, deltaText, children }) {
    return (
        <div className="rounded-3xl border border-black/50 bg-white/75 backdrop-blur px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.08)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
                    <div className="mt-1 flex items-end gap-2">
                        <div className="text-[20px] font-semibold tracking-tight text-slate-900 tabular-nums">{value ?? '—'}</div>
                        <div className="text-[12px] text-slate-500 pb-0.5">{unit}</div>
                    </div>
                    <div className="mt-2"><TrendChip dir={dir} deltaText={deltaText} /></div>
                </div>
                <div className="text-slate-900">{children}</div>
            </div>
        </div>
    )
}

function Segmented({ value, onChange }) {
    return (
        <div className="flex items-center gap-1.5 overflow-auto no-scrollbar py-1">
            {TRIAGE_STATUS.map((opt) => {
                const active = value === opt.key
                return (
                    <button
                        key={opt.key}
                        type="button"
                        onClick={() => onChange(opt.key)}
                        className={cx(
                            'whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                            active ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-black/50 bg-white/75 text-slate-700 hover:bg-black/[0.03]',
                        )}
                    >
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

/* ----------------------------- Row helpers ----------------------------- */
function patientName(row) {
    return row?.patient?.name || row?.patient_name || row?.patientName || '—'
}
function patientUHID(row) {
    return row?.patient?.uhid || row?.uhid || '—'
}
function patientPhone(row) {
    return row?.patient?.phone || row?.phone || ''
}
function doctorName(row) {
    return row?.doctor?.name || row?.doctor_name || ''
}
function deptName(row) {
    return row?.department?.name || row?.department_name || ''
}

/* ----------------------------- Component ----------------------------- */
export default function Triage() {
    const { user } = useAuth() || {}
    const navigate = useNavigate()
    const location = useLocation()

    // filters
    const [doctorId, setDoctorId] = useState(null)         // optional
    const [deptId, setDeptId] = useState(null)             // optional (set from DoctorPicker dept selection)
    const [doctorMeta, setDoctorMeta] = useState(null)     // {department_id, department_name, doctor_name, doctor_email}

    const [date, setDate] = useState(todayStr())
    const [statusFilter, setStatusFilter] = useState('active')
    const [q, setQ] = useState('')

    // “My appointments” toggle
    const [myOnly, setMyOnly] = useState(false)
    const prevDoctorRef = useRef({ id: null, meta: null, deptId: null })

    // list
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    // deep-link support from Queue (open triage for a specific appointment)
    const [autoOpenApptId, setAutoOpenApptId] = useState(null)

    // modal
    const [open, setOpen] = useState(false)
    const [target, setTarget] = useState(null)

    // vitals form
    const [form, setForm] = useState({ ...resetFormObj })
    const [saving, setSaving] = useState(false)
    const vitalsFormRef = useRef(null)

    // prefill/meta/history
    const [vitalsLoading, setVitalsLoading] = useState(false)
    const [vitalsMeta, setVitalsMeta] = useState(null)
    const [prefilled, setPrefilled] = useState(false)

    const [historyLoading, setHistoryLoading] = useState(false)
    const [history, setHistory] = useState([])

    const contentTopRef = useRef(null)

    const hasDate = Boolean(date)

    const effectiveDoctorId = myOnly ? user?.id : doctorId
    const effectiveDeptId = myOnly ? null : (doctorId ? null : deptId) // dept filter only when doctor not selected

    const handleDoctorChange = (id, meta) => {
        if (myOnly) return
        setDoctorId(id)
        setDoctorMeta(meta || null)
        setDeptId(meta?.department_id ?? null)
    }

    const toggleMyOnly = () => {
        if (!user?.id) return toast.error('No logged-in user found')

        setMyOnly((v) => {
            const next = !v
            if (next) {
                prevDoctorRef.current = { id: doctorId, meta: doctorMeta, deptId }
                setDoctorId(user.id)
                setDoctorMeta({ doctor_name: user?.name || user?.full_name || 'Me' })
                setDeptId(null)
                toast.success('Showing my appointments only')
            } else {
                const prev = prevDoctorRef.current || {}
                setDoctorId(prev?.id || null)
                setDoctorMeta(prev?.meta || null)
                setDeptId(prev?.deptId || null)
                toast.success('Showing all / filtered triage')
            }
            return next
        })
    }

    // Deep link handler (from Queue → Triage)
    useEffect(() => {
        const st = location?.state || null
        if (!st) return

        const d = st?.date
        const apptId = st?.appointmentId

        if (d) setDate(d)
        if (apptId) setAutoOpenApptId(Number(apptId))

        // IMPORTANT: we no longer need doctorId for deep-link because triage loads ALL by date
        navigate(location.pathname, { replace: true, state: null })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const load = useCallback(async () => {
        if (!hasDate) {
            setRows([])
            return
        }
        try {
            setLoading(true)
            const { data } = await fetchQueue({
                for_date: date,
                doctor_user_id: effectiveDoctorId || undefined,
                department_id: effectiveDeptId || undefined,
            })
            setRows(Array.isArray(data) ? data : [])
        } catch {
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [hasDate, date, effectiveDoctorId, effectiveDeptId])

    useEffect(() => { load() }, [load])

    const applyVitalsToForm = (data) => {
        setForm({
            height_cm: toStr(data?.height_cm),
            weight_kg: toStr(data?.weight_kg),
            temp_c: toStr(data?.temp_c),
            pulse: toStr(data?.pulse),
            resp_rate: toStr(data?.resp_rate),
            spo2: toStr(data?.spo2),
            bp_sys: toStr(data?.bp_sys),
            bp_dia: toStr(data?.bp_dia),
            notes: data?.notes ?? '',
        })
    }

    const loadHistory = async (row) => {
        try {
            setHistoryLoading(true)
            const { data } = await fetchVitalsHistory({
                appointment_id: row.appointment_id,
                for_date: date,
                limit: 14,
            })
            setHistory(Array.isArray(data) ? data : [])
        } catch {
            setHistory([])
        } finally {
            setHistoryLoading(false)
        }
    }

    const openVitals = async (row) => {
        setTarget(row)
        setOpen(true)

        setForm({ ...resetFormObj })
        setVitalsMeta(null)
        setPrefilled(false)
        setHistory([])

        requestAnimationFrame(() => {
            contentTopRef.current?.scrollIntoView?.({ behavior: 'instant', block: 'start' })
        })

        loadHistory(row)

        if (row?.has_vitals) {
            try {
                setVitalsLoading(true)
                const { data } = await fetchLatestVitals({
                    appointment_id: row.appointment_id,
                    for_date: date,
                })
                applyVitalsToForm(data)
                setVitalsMeta({ id: data?.id, created_at: data?.created_at })
                setPrefilled(true)
            } catch {
                setVitalsMeta(null)
                setPrefilled(false)
            } finally {
                setVitalsLoading(false)
            }
        }
    }

    // auto-open appointment vitals after load
    useEffect(() => {
        if (!autoOpenApptId) return
        if (loading) return
        if (open) return
        const found = (rows || []).find((r) => Number(r?.appointment_id) === Number(autoOpenApptId))
        if (found) {
            openVitals(found)
            setAutoOpenApptId(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, loading, autoOpenApptId])

    const closeModal = () => {
        setOpen(false)
        setTarget(null)
        setForm({ ...resetFormObj })
        setVitalsMeta(null)
        setPrefilled(false)
        setHistory([])
    }

    const refreshPrefill = async () => {
        if (!target) return
        try {
            setVitalsLoading(true)
            const { data } = await fetchLatestVitals({
                appointment_id: target.appointment_id,
                for_date: date,
            })
            applyVitalsToForm(data)
            setVitalsMeta({ id: data?.id, created_at: data?.created_at })
            setPrefilled(true)
            toast.success('Latest vitals loaded')
            loadHistory(target)
        } catch {
            toast.error('No existing vitals found')
        } finally {
            setVitalsLoading(false)
        }
    }

    const saveVitals = async (e) => {
        e.preventDefault()
        if (!target) return

        try {
            setSaving(true)
            const payload = {
                appointment_id: target.appointment_id,
                height_cm: form.height_cm ? Number(form.height_cm) : undefined,
                weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
                temp_c: form.temp_c ? Number(form.temp_c) : undefined,
                pulse: form.pulse ? Number(form.pulse) : undefined,
                resp_rate: form.resp_rate ? Number(form.resp_rate) : undefined,
                spo2: form.spo2 ? Number(form.spo2) : undefined,
                bp_sys: form.bp_sys ? Number(form.bp_sys) : undefined,
                bp_dia: form.bp_dia ? Number(form.bp_dia) : undefined,
                notes: form.notes || undefined,
            }

            await recordVitals(payload)

            toast.success(target?.has_vitals ? 'Vitals updated' : 'Vitals recorded')
            closeModal()
            await load()
        } finally {
            setSaving(false)
        }
    }

    /* ----------------------------- Computeds ----------------------------- */
    const severity = useMemo(() => vitalsSeverity(form), [form])
    const bmi = useMemo(() => computeBMI(form.height_cm, form.weight_kg), [form.height_cm, form.weight_kg])
    const bmiInfo = useMemo(() => bmiLabel(bmi), [bmi])

    const severityUI = useMemo(() => {
        if (severity.level === 2) return { icon: ShieldAlert, pill: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' }
        if (severity.level === 1) return { icon: AlertTriangle, pill: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' }
        return { icon: CheckCircle2, pill: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
    }, [severity.level])

    const SeverityIcon = severityUI.icon
    const busy = saving || loading || vitalsLoading || historyLoading

    const byStatus = useMemo(() => {
        if (statusFilter === 'all') return rows
        if (statusFilter === 'active') return rows.filter((r) => ['booked', 'checked_in', 'in_progress'].includes(r.status))
        return rows.filter((r) => r.status === statusFilter)
    }, [rows, statusFilter])

    const filteredRows = useMemo(() => {
        const s = (q || '').trim().toLowerCase()
        if (!s) return byStatus
        return byStatus.filter((r) => {
            const name = patientName(r).toLowerCase()
            const uhid = patientUHID(r).toLowerCase()
            const phone = (patientPhone(r) || '').toLowerCase()
            const doc = (doctorName(r) || '').toLowerCase()
            const dep = (deptName(r) || '').toLowerCase()
            return name.includes(s) || uhid.includes(s) || phone.includes(s) || doc.includes(s) || dep.includes(s)
        })
    }, [byStatus, q])

    const total = rows.length
    const doneVitals = rows.filter((r) => !!r?.has_vitals).length
    const needVitals = total - doneVitals

    // Prepare chart series from history (sorted ASC)
    const historyAsc = useMemo(() => {
        const arr = Array.isArray(history) ? [...history] : []
        arr.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        return arr
    }, [history])

    const pulseSeries = useMemo(() => safeSeries(historyAsc, (h) => h.pulse), [historyAsc])
    const spo2Series = useMemo(() => safeSeries(historyAsc, (h) => h.spo2), [historyAsc])
    const tempSeries = useMemo(() => safeSeries(historyAsc, (h) => h.temp_c), [historyAsc])
    const bpSysSeries = useMemo(() => safeSeries(historyAsc, (h) => h.bp_sys), [historyAsc])
    const bpDiaSeries = useMemo(() => safeSeries(historyAsc, (h) => h.bp_dia), [historyAsc])

    const pulseT = useMemo(() => trendInfo(pulseSeries), [pulseSeries])
    const spo2T = useMemo(() => trendInfo(spo2Series), [spo2Series])
    const tempT = useMemo(() => trendInfo(tempSeries), [tempSeries])
    const bpSysT = useMemo(() => trendInfo(bpSysSeries), [bpSysSeries])
    const bpDiaT = useMemo(() => trendInfo(bpDiaSeries), [bpDiaSeries])

    const last3Entries = useMemo(() => [...historyAsc].reverse().slice(0, 3), [historyAsc])

    const filterChipLabel = useMemo(() => {
        if (myOnly) return `${user?.name || user?.full_name || 'Me'} (Me)`
        if (effectiveDoctorId) return doctorMeta?.doctor_name || doctorMeta?.name || 'Doctor filter'
        if (effectiveDeptId) return doctorMeta?.department_name ? `Dept: ${doctorMeta.department_name}` : 'Department filter'
        return 'All doctors'
    }, [myOnly, user, effectiveDoctorId, effectiveDeptId, doctorMeta])

    return (
        <div className={cx('min-h-[calc(100vh-4rem)] w-full bg-slate-50', UI.pageBg)}>
            <div className="px-4 py-5 md:px-8 md:py-8">
                <div className="space-y-4 md:space-y-5">
                    {/* Top meta row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-700">
                            OPD · Triage & Vitals (List-first + filters)
                        </Badge>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
                            <span>Live queue</span>
                        </div>
                    </div>

                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                        <div className={cx(UI.glass, 'relative overflow-hidden')}>
                            <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_60%)]" />
                            <div className="relative px-5 py-5 md:px-7 md:py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-700">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.04] border border-black/50">
                                            <Sparkles className="h-3.5 w-3.5 text-slate-700" />
                                        </span>
                                        Apple-glass workflow · List-first
                                    </div>

                                    <div className="mt-3 flex items-start gap-3">
                                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                                            <HeartPulse className="h-5 w-5 text-slate-700" />
                                        </div>
                                        <div className="min-w-0">
                                            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">OPD Triage</h1>
                                            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                                                Default shows all appointments for the date. Use filters to narrow to department/doctor/my-only.
                                            </p>

                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <span className={UI.chip}>
                                                    <CalendarDays className="h-3.5 w-3.5" />
                                                    {prettyDate(date)}
                                                </span>

                                                <span className={UI.chip}>
                                                    <Stethoscope className="h-3.5 w-3.5" />
                                                    {filterChipLabel}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={toggleMyOnly}
                                                    className={cx(UI.chipBtn, myOnly && 'bg-slate-900')}
                                                    disabled={!user?.id}
                                                    title="Filter by logged-in doctor_user_id"
                                                >
                                                    {myOnly ? <Lock className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                                                    My appointments
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full md:w-[560px] space-y-3">
                                    <div className={cx(UI.glassSoft, 'p-3')}>
                                        <div className="grid gap-2">
                                            <div
                                                className={cx('rounded-2xl border border-black/50 bg-white/75 px-3 py-2', myOnly && 'opacity-70 pointer-events-none')}
                                                title={myOnly ? 'My appointments is ON (doctor locked)' : 'Optional: filter by department/doctor'}
                                            >
                                                <div className="flex items-center gap-2 pb-1">
                                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.04] border border-black/50">
                                                        <Building2 className="h-3.5 w-3.5 text-slate-700" />
                                                    </span>
                                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filters</span>
                                                </div>
                                                <DoctorPicker value={doctorId} onChange={handleDoctorChange} />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 space-y-1">
                                                    <div className="text-[11px] font-semibold text-slate-600">Date</div>
                                                    <Input
                                                        type="date"
                                                        value={date}
                                                        onChange={(e) => setDate(e.target.value)}
                                                        className="h-10 rounded-2xl border-black/50 bg-white/85 text-sm"
                                                    />
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                                    onClick={load}
                                                    disabled={loading || !hasDate}
                                                >
                                                    <RefreshCcw className={cx('mr-2 h-4 w-4', loading && 'animate-spin')} />
                                                    Refresh
                                                </Button>
                                            </div>

                                            <Separator className="bg-black/10" />

                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</div>
                                                <span className={UI.chip}>
                                                    Showing <span className="ml-1 tabular-nums">{filteredRows.length}</span>
                                                </span>
                                            </div>

                                            <Segmented value={statusFilter} onChange={setStatusFilter} />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={UI.chip}>Total <span className="ml-1 tabular-nums">{total}</span></span>
                                        <span className={UI.chip}>Done <span className="ml-1 tabular-nums">{doneVitals}</span></span>
                                        <span className={UI.chip}>Need vitals <span className="ml-1 tabular-nums">{needVitals}</span></span>

                                        <div className="ml-auto relative w-full md:w-[260px]">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                value={q}
                                                onChange={(e) => setQ(e.target.value)}
                                                placeholder="Search name / UHID / phone / doctor / dept…"
                                                className={cx(UI.input, 'pl-10 h-10')}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Queue list */}
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                        <Card className={cx(UI.glass, 'overflow-hidden')}>
                            <CardHeader className="border-b border-black/50">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">Queue</CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Tap a patient to record / update vitals. List loads first, then filters apply.
                                        </CardDescription>
                                    </div>

                                    {busy && (
                                        <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px] font-semibold text-slate-600">
                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                            Syncing
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="pt-4">
                                {loading ? (
                                    <div className="space-y-2">
                                        {Array.from({ length: 7 }).map((_, i) => (
                                            <Skeleton key={i} className="h-16 w-full rounded-3xl bg-slate-100" />
                                        ))}
                                    </div>
                                ) : filteredRows.length === 0 ? (
                                    <div className="rounded-3xl border border-dashed border-black/15 bg-black/[0.02] px-5 py-7 text-center">
                                        <div className="mx-auto h-12 w-12 rounded-3xl bg-black/[0.04] border border-black/50 grid place-items-center">
                                            <User2 className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <div className="mt-3 font-semibold text-slate-900">No appointments</div>
                                        <div className="mt-1 text-[12px] text-slate-500">Try changing date or clearing filters.</div>
                                    </div>
                                ) : (
                                    <ScrollArea className="max-h-[62vh] pr-2">
                                        <div className="space-y-2">
                                            {filteredRows.map((row) => {
                                                const pName = patientName(row)
                                                const uhid = patientUHID(row)
                                                const phone = patientPhone(row)
                                                const doc = doctorName(row)
                                                const dep = deptName(row)
                                                return (
                                                    <button
                                                        key={row.appointment_id}
                                                        type="button"
                                                        onClick={() => openVitals(row)}
                                                        className={cx(
                                                            'w-full text-left rounded-3xl border border-black/50 bg-white/75 backdrop-blur px-4 py-3',
                                                            'shadow-[0_10px_24px_rgba(2,6,23,0.08)] hover:bg-white/90 transition',
                                                            'active:scale-[0.995]'
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                                                                        {row.time || '—'}
                                                                    </span>

                                                                    <span className={statusPill(row.status)}>{row.status}</span>

                                                                    <div className="font-semibold text-slate-900 truncate">{pName}</div>
                                                                    <div className="text-[12px] text-slate-500">UHID {uhid}</div>
                                                                </div>

                                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <User2 className="h-4 w-4 text-slate-400" />
                                                                        {phone || 'No phone'}
                                                                    </span>

                                                                    {/* show doctor/dept when list is broad */}
                                                                    {!effectiveDoctorId ? (
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <Stethoscope className="h-4 w-4 text-slate-400" />
                                                                            <span className="font-semibold text-slate-700">{doc || '—'}</span>
                                                                            {dep ? <span className="text-slate-500">· {dep}</span> : null}
                                                                        </span>
                                                                    ) : null}

                                                                    {!!row?.has_vitals ? (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                                                            <CheckCircle2 className="h-4 w-4" />
                                                                            Vitals recorded
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-black/50">
                                                                            <Activity className="h-4 w-4" />
                                                                            Not recorded
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="shrink-0 flex items-center gap-2">
                                                                {row?.visit_id ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700" title="Visit already created">
                                                                        <Clock className="h-3.5 w-3.5" />
                                                                        Visit
                                                                    </span>
                                                                ) : null}

                                                                <span className="inline-flex items-center rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700">
                                                                    {row?.has_vitals ? 'View / Update' : 'Record'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <div className="h-6" />
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>

            {/* --------------------------- Fullscreen Vitals Modal --------------------------- */}
            <AnimatePresence>
                {open && target && (
                    <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={closeModal} />

                        <motion.div
                            className="absolute inset-0 bg-white"
                            initial={{ y: 18, opacity: 0, scale: 0.995 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 18, opacity: 0, scale: 0.995 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                        >
                            <div className="h-full flex flex-col min-h-0">
                                {/* Sticky header */}
                                <div className="sticky top-0 z-30 border-b border-black/50 bg-white/80 backdrop-blur-xl">
                                    <div className="px-4 md:px-8 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={closeModal}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/[0.04] border border-black/50 hover:bg-black/[0.06]"
                                                        title="Back"
                                                    >
                                                        <ArrowLeft className="h-5 w-5 text-slate-700" />
                                                    </button>

                                                    <div className="min-w-0">
                                                        <div className="text-[16px] md:text-[18px] font-semibold text-slate-900 tracking-tight truncate">
                                                            Vitals · {patientName(target)}
                                                        </div>
                                                        <div className="mt-0.5 text-[12px] text-slate-500 flex flex-wrap items-center gap-2">
                                                            <span>UHID {patientUHID(target)}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span>Time {target?.time || '—'}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className={statusPill(target?.status)}>{target?.status}</span>

                                                            {(doctorName(target) || deptName(target)) && (
                                                                <>
                                                                    <span className="text-slate-300">•</span>
                                                                    <span className="font-semibold text-slate-700">
                                                                        {doctorName(target) || '—'}{deptName(target) ? ` · ${deptName(target)}` : ''}
                                                                    </span>
                                                                </>
                                                            )}

                                                            {vitalsMeta?.created_at && (
                                                                <>
                                                                    <span className="text-slate-300">•</span>
                                                                    <span>
                                                                        Last: <span className="font-semibold text-slate-700">{niceDT(vitalsMeta.created_at)}</span>
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <span className={cx('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold', severityUI.pill)}>
                                                        <span className={cx('h-1.5 w-1.5 rounded-full', severityUI.dot)} />
                                                        <SeverityIcon className="h-4 w-4" />
                                                        {severity.label}
                                                    </span>

                                                    {bmi !== null && bmiInfo && (
                                                        <span
                                                            className={cx(
                                                                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold',
                                                                bmiInfo.tone === 'critical'
                                                                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                                                                    : bmiInfo.tone === 'warning'
                                                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                            )}
                                                        >
                                                            BMI {bmi} · {bmiInfo.label}
                                                        </span>
                                                    )}

                                                    {prefilled ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            Existing loaded
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.03] px-3 py-1 text-[11px] font-semibold text-slate-700 border border-black/50">
                                                            <Activity className="h-4 w-4" />
                                                            New entry
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {target?.has_vitals && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={refreshPrefill}
                                                        disabled={vitalsLoading || saving}
                                                        className="rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                    >
                                                        <RefreshCcw className={cx('h-4 w-4 mr-2', vitalsLoading && 'animate-spin')} />
                                                        Load latest
                                                    </Button>
                                                )}

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={closeModal}
                                                    className="rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                    disabled={saving}
                                                >
                                                    <X className="h-4 w-4 mr-2" />
                                                    Close
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-5">
                                    <div ref={contentTopRef} />

                                    <div className="grid gap-4">
                                        {/* Trends */}
                                        <Card className={cx(UI.glass, 'overflow-hidden')}>
                                            <CardHeader className="border-b border-black/50">
                                                <CardTitle className="text-base md:text-lg font-semibold text-slate-900">Trends</CardTitle>
                                                <CardDescription className="text-[12px] text-slate-600">Mini charts + change from previous record.</CardDescription>
                                            </CardHeader>

                                            <CardContent className="pt-4">
                                                {historyLoading ? (
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <Skeleton className="h-24 rounded-3xl bg-slate-100" />
                                                        <Skeleton className="h-24 rounded-3xl bg-slate-100" />
                                                        <Skeleton className="h-24 rounded-3xl bg-slate-100" />
                                                        <Skeleton className="h-24 rounded-3xl bg-slate-100" />
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <TrendTile title="Pulse" value={pulseT.current} unit="bpm" dir={pulseT.dir} deltaText={formatDelta(pulseT.delta, 0)}>
                                                            <Sparkline series={pulseSeries} />
                                                        </TrendTile>

                                                        <TrendTile title="SpO₂" value={spo2T.current} unit="%" dir={spo2T.dir} deltaText={formatDelta(spo2T.delta, 0)}>
                                                            <Sparkline series={spo2Series} />
                                                        </TrendTile>

                                                        <TrendTile
                                                            title="BP"
                                                            value={bpSysT.current !== null || bpDiaT.current !== null ? `${bpSysT.current ?? '—'}/${bpDiaT.current ?? '—'}` : null}
                                                            unit="mmHg"
                                                            dir={bpSysT.dir !== 'flat' ? bpSysT.dir : bpDiaT.dir}
                                                            deltaText={bpSysT.delta !== null || bpDiaT.delta !== null ? `${formatDelta(bpSysT.delta, 0)}/${formatDelta(bpDiaT.delta, 0)}` : '—'}
                                                        >
                                                            <Sparkline series={bpSysSeries} series2={bpDiaSeries} />
                                                        </TrendTile>

                                                        <TrendTile title="Temperature" value={tempT.current} unit="°C" dir={tempT.dir} deltaText={formatDelta(tempT.delta, 1)}>
                                                            <Sparkline series={tempSeries} />
                                                        </TrendTile>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {/* Vitals Form */}
                                        <Card className={cx(UI.glass, 'overflow-hidden')}>
                                            <CardHeader className="border-b border-black/50">
                                                <CardTitle className="text-base md:text-lg font-semibold text-slate-900 flex items-center gap-2">
                                                    <HeartPulse className="h-5 w-5 text-slate-700" />
                                                    Vitals entry
                                                </CardTitle>
                                                <CardDescription className="text-[12px] text-slate-600">Fast single-column capture with BP inline and notes.</CardDescription>
                                            </CardHeader>

                                            <CardContent className="pt-4">
                                                <form ref={vitalsFormRef} onSubmit={saveVitals} className="space-y-4">
                                                    <Field label="Height (cm)">
                                                        <Input type="number" inputMode="decimal" value={form.height_cm}
                                                            onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
                                                            className="h-11 rounded-2xl border-black/50 bg-white/85" />
                                                    </Field>

                                                    <Field label="Weight (kg)">
                                                        <Input type="number" inputMode="decimal" value={form.weight_kg}
                                                            onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                                                            className="h-11 rounded-2xl border-black/50 bg-white/85" />
                                                    </Field>

                                                    <Field label={<span className="inline-flex items-center gap-2">Temperature (°C) <Thermometer className="h-4 w-4 text-slate-500" /></span>}>
                                                        <Input type="number" inputMode="decimal" value={form.temp_c}
                                                            onChange={(e) => setForm((f) => ({ ...f, temp_c: e.target.value }))}
                                                            className="h-11 rounded-2xl border-black/50 bg-white/85" />
                                                    </Field>

                                                    <Field label="Pulse (bpm)">
                                                        <Input type="number" inputMode="numeric" value={form.pulse}
                                                            onChange={(e) => setForm((f) => ({ ...f, pulse: e.target.value }))}
                                                            className="h-11 rounded-2xl border-black/50 bg-white/85" />
                                                    </Field>

                                                    <Field label="Resp. rate">
                                                        <Input type="number" inputMode="numeric" value={form.resp_rate}
                                                            onChange={(e) => setForm((f) => ({ ...f, resp_rate: e.target.value }))}
                                                            className="h-11 rounded-2xl border-black/50 bg-white/85" />
                                                    </Field>

                                                    <Field label="SpO₂ (%)">
                                                        <Input type="number" inputMode="decimal" value={form.spo2}
                                                            onChange={(e) => setForm((f) => ({ ...f, spo2: e.target.value }))}
                                                            className="h-11 rounded-2xl border-black/50 bg-white/85" />
                                                    </Field>

                                                    <Field label="BP (sys / dia)">
                                                        <div className="flex gap-2">
                                                            <Input type="number" inputMode="numeric" value={form.bp_sys}
                                                                onChange={(e) => setForm((f) => ({ ...f, bp_sys: e.target.value }))}
                                                                placeholder="Sys" className="h-11 rounded-2xl border-black/50 bg-white/85" />
                                                            <Input type="number" inputMode="numeric" value={form.bp_dia}
                                                                onChange={(e) => setForm((f) => ({ ...f, bp_dia: e.target.value }))}
                                                                placeholder="Dia" className="h-11 rounded-2xl border-black/50 bg-white/85" />
                                                        </div>
                                                    </Field>

                                                    <Field label="Notes">
                                                        <Textarea value={form.notes}
                                                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                                            className="min-h-[100px] rounded-2xl border-black/50 bg-white/85"
                                                            placeholder="Pain score, alerts, triage notes…" />
                                                    </Field>

                                                    <Separator className="bg-black/10" />

                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-[12px] text-slate-500">Badges update live as you type.</div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Button type="button" variant="outline"
                                                                className="rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                                onClick={() => setForm({ ...resetFormObj })}
                                                                disabled={saving || vitalsLoading}>
                                                                Clear
                                                            </Button>

                                                            <Button type="submit"
                                                                className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                                disabled={saving || vitalsLoading}>
                                                                <Save className="h-4 w-4 mr-2" />
                                                                {saving ? 'Saving…' : target?.has_vitals ? 'Update vitals' : 'Save vitals'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </form>
                                            </CardContent>
                                        </Card>

                                        {/* History last 3 */}
                                        <Card className={cx(UI.glass, 'overflow-hidden')}>
                                            <CardHeader className="border-b border-black/50">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <CardTitle className="text-base md:text-lg font-semibold text-slate-900 flex items-center gap-2">
                                                            <History className="h-5 w-5 text-slate-700" />
                                                            History (last 3)
                                                        </CardTitle>
                                                        <CardDescription className="text-[12px] text-slate-600">Load one entry into the form (quick compare).</CardDescription>
                                                    </div>

                                                    <Button type="button" variant="outline"
                                                        className="rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                        onClick={() => loadHistory(target)}
                                                        disabled={historyLoading}>
                                                        <RefreshCcw className={cx('h-4 w-4 mr-2', historyLoading && 'animate-spin')} />
                                                        Refresh
                                                    </Button>
                                                </div>
                                            </CardHeader>

                                            <CardContent className="pt-4">
                                                {historyLoading ? (
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-20 w-full rounded-3xl bg-slate-100" />
                                                        <Skeleton className="h-20 w-full rounded-3xl bg-slate-100" />
                                                        <Skeleton className="h-20 w-full rounded-3xl bg-slate-100" />
                                                    </div>
                                                ) : last3Entries.length === 0 ? (
                                                    <div className="rounded-3xl border border-dashed border-black/15 bg-black/[0.02] px-5 py-7 text-center">
                                                        <div className="mx-auto h-12 w-12 rounded-3xl bg-black/[0.04] border border-black/50 grid place-items-center">
                                                            <History className="h-6 w-6 text-slate-400" />
                                                        </div>
                                                        <div className="mt-3 font-semibold text-slate-900">No history</div>
                                                        <div className="mt-1 text-[12px] text-slate-500">No vitals history found.</div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {last3Entries.map((h) => (
                                                            <div key={h.id} className="rounded-3xl border border-black/50 bg-white/75 backdrop-blur px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.08)]">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <div className="text-[12px] text-slate-500">{niceDT(h.created_at)}</div>
                                                                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                                                                            <ChipMini label="Temp" value={toStr(h.temp_c) || '—'} />
                                                                            <ChipMini label="SpO₂" value={toStr(h.spo2) || '—'} />
                                                                            <ChipMini label="Pulse" value={toStr(h.pulse) || '—'} />
                                                                            <ChipMini label="BP" value={`${toStr(h.bp_sys) || '—'}/${toStr(h.bp_dia) || '—'}`} />
                                                                            <ChipMini label="RR" value={toStr(h.resp_rate) || '—'} />
                                                                        </div>
                                                                    </div>

                                                                    <Button
                                                                        type="button"
                                                                        className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                                        onClick={() => {
                                                                            applyVitalsToForm(h)
                                                                            setVitalsMeta({ id: h.id, created_at: h.created_at })
                                                                            setPrefilled(true)
                                                                            toast.success('Loaded from history')
                                                                            contentTopRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
                                                                        }}
                                                                    >
                                                                        Load
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <div className="h-10" />
                                    </div>
                                </div>

                                {/* Bottom action bar */}
                                <div className="sticky bottom-0 z-30 border-t border-black/50 bg-white/80 backdrop-blur-xl">
                                    <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-2">
                                        <div className="text-[12px] text-slate-500 flex items-center gap-2">
                                            {busy ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Working…
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                    Ready
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {target?.visit_id ? (
                                                <Button type="button" variant="outline"
                                                    className="rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                    onClick={() => navigate(`/opd/visit/${target.visit_id}`)}
                                                    disabled={saving}
                                                    title="Open visit">
                                                    Open visit
                                                </Button>
                                            ) : null}

                                            <Button type="button" variant="outline"
                                                className="rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                onClick={closeModal}
                                                disabled={saving}>
                                                Close
                                            </Button>

                                            <Button type="button"
                                                className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                onClick={() => vitalsFormRef.current?.requestSubmit?.()}
                                                disabled={saving || vitalsLoading}
                                                title="Save vitals">
                                                <Save className="h-4 w-4 mr-2" />
                                                {saving ? 'Saving…' : 'Save'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/* ----------------------------- Small UI Bits ----------------------------- */
function Field({ label, children }) {
    return (
        <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-600">{label}</div>
            {children}
        </div>
    )
}

function ChipMini({ label, value }) {
    return (
        <span className="inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-900 tabular-nums">{value}</span>
        </span>
    )
}
