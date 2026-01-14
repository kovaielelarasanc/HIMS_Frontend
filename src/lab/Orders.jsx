// FILE: src/lab/Orders.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { listLisOrders, createLisOrder, listPatientEncounters } from '../api/lab'
import { toast } from 'sonner'
import {
    Plus,
    Search,
    FlaskConical,
    Filter,
    RefreshCw,
    X,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Sparkles,
    Loader2,
    Stethoscope,
    BedDouble,
    Link2,
} from 'lucide-react'
import PatientPicker from '../opd/components/patientPicker'
import LabTestPicker from './components/LabTestPicker'
import { Link, useNavigate } from 'react-router-dom'
import PermGate from '../components/PermGate'
import OrderBadge from '../components/OrderBadge'
import PatientBadge from '../components/PatientBadge'
import StatusBadge from '../components/StatusBadge'
import { formatIST } from '@/ipd/components/timeZONE'

/* -------------------- utils (stable) -------------------- */
const APP_LOCALE = 'en-IN'
const APP_TZ = 'Asia/Kolkata'
const BACKEND_NAIVE_TZ = 'APP' // 'APP' (IST) or 'UTC'
const IST_OFFSET_MIN = 330

function parseBackendDate(v) {
    if (!v) return null
    if (v instanceof Date) return isNaN(v) ? null : v
    if (typeof v === 'number') return new Date(v)

    const s = String(v).trim()
    if (!s) return null

    if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
        const d = new Date(s)
        return isNaN(d) ? null : d
    }

    const m = s.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/
    )
    if (m) {
        const Y = Number(m[1])
        const M = Number(m[2]) - 1
        const D = Number(m[3])
        const h = Number(m[4])
        const mi = Number(m[5])
        const sec = Number(m[6] || 0)
        const ms = Number((m[7] || '0').padEnd(3, '0'))

        if (BACKEND_NAIVE_TZ === 'UTC') return new Date(Date.UTC(Y, M, D, h, mi, sec, ms))
        const utcMs = Date.UTC(Y, M, D, h, mi, sec, ms) - IST_OFFSET_MIN * 60 * 1000
        return new Date(utcMs)
    }

    const d = new Date(s)
    return isNaN(d) ? null : d
}

const DTF = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
})

const YMD = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
})

const fmtDT = (v) => {
    const d = parseBackendDate(v)
    return d ? DTF.format(d) : '—'
}

const ymdInTz = (v) => {
    const d = parseBackendDate(v)
    return d ? YMD.format(d) : null
}

const formatOrderNo = (id) => {
    if (!id) return '—'
    const s = String(id)
    return `LAB-${s.padStart(6, '0')}`
}

const STEPS = [
    { key: 'patient', title: 'Patient' },
    { key: 'tests', title: 'Tests' },
    { key: 'review', title: 'Review' },
]

const PRIORITY_OPTS = [
    { key: 'routine', label: 'Routine', hint: 'Standard queue' },
    { key: 'urgent', label: 'Urgent', hint: 'High priority' },
    { key: 'stat', label: 'STAT', hint: 'Immediate' },
]

const CONTEXT_OPTS = [
    { key: 'opd', label: 'OPD Visit', hint: 'Visit.id (OPD encounter)', icon: Stethoscope },
    { key: 'ipd', label: 'IPD Admission', hint: 'IpdAdmission.id (IPD encounter)', icon: BedDouble },
]

function useDebounced(value, delay = 300) {
    const [v, setV] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return v
}

function useLatest(value) {
    const ref = useRef(value)
    useEffect(() => {
        ref.current = value
    }, [value])
    return ref
}

function useEvent(handler) {
    const handlerRef = useLatest(handler)
    return useCallback((...args) => handlerRef.current?.(...args), [handlerRef])
}

function shallowArrayEq(a, b) {
    if (a === b) return true
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (String(a[i]) !== String(b[i])) return false
    }
    return true
}

function pickId(x) {
    if (!x) return null
    if (typeof x === 'number' || typeof x === 'string') return x
    return x.id ?? x.patient_id ?? x.patientId ?? x.value ?? x.key ?? null
}

function patientLabel(patientMeta, patientId) {
    if (patientMeta && typeof patientMeta === 'object') {
        const uhid = patientMeta.uhid || patientMeta.UHID || patientMeta.patient_uhid
        const full =
            patientMeta.full_name ||
            patientMeta.fullName ||
            patientMeta.name ||
            `${patientMeta.first_name || ''} ${patientMeta.last_name || ''}`.trim()
        if (full && uhid) return `${full} • ${uhid}`
        if (full) return full
        if (uhid) return uhid
    }
    return patientId ? `Patient #${patientId}` : 'Not selected'
}

function testId(t) {
    if (!t) return null
    if (typeof t === 'number' || typeof t === 'string') return t
    return t.id ?? t.test_id ?? t.value ?? t.key ?? null
}

function testLabel(t) {
    if (!t) return ''
    if (typeof t === 'number' || typeof t === 'string') return `#${t}`
    const code = t.code || t.test_code
    const name = t.name || t.test_name
    if (code && name) return `${code} — ${name}`
    return name || code || `#${testId(t) || ''}`
}

function contextText(type, id) {
    const t = (type || '').toString().toUpperCase()
    if (!t && !id) return 'Not selected'
    if (t && id) return `${t} • #${id}`
    return t || `#${id}`
}

/* -------------------- Tests on Orders page -------------------- */

const getOrderItems = (o) => {
    const a = o?.items
    const b = o?.order_items
    const c = o?.orderItems
    if (Array.isArray(a)) return a
    if (Array.isArray(b)) return b
    if (Array.isArray(c)) return c
    return []
}

const testChipText = (it) => {
    if (!it) return 'Test'
    const code = it.test_code || it.testCode || it.code
    const name = it.test_name || it.testName || it.name
    if (code && name) return `${code} — ${name}`
    return name || code || 'Test'
}

const summarizeItems = (items, max = 3) => {
    const safe = Array.isArray(items) ? items : []
    if (!safe.length) return { chips: [], more: 0, allText: '' }
    const chips = safe.slice(0, max).map(testChipText)
    const more = Math.max(0, safe.length - max)
    const allText = safe.map(testChipText).join(' • ')
    return { chips, more, allText }
}

const TestChips = memo(function TestChips({ items, max = 3, compact = false }) {
    const { chips, more, allText } = useMemo(() => summarizeItems(items, max), [items, max])

    if (!chips.length) {
        return (
            <div className={compact ? 'text-[11px] text-slate-500' : 'mt-2 text-xs text-slate-500'}>
                Tests: <span className="font-semibold text-slate-700">—</span>
            </div>
        )
    }

    return (
        <div className={compact ? '' : 'mt-2'}>
            <div className="flex flex-wrap items-center gap-1.5" title={allText}>
                {chips.map((t, idx) => (
                    <span
                        key={`${t}-${idx}`}
                        className={[
                            'inline-flex max-w-full items-center rounded-full',
                            'border border-slate-200 bg-white',
                            compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[11px]',
                            'font-semibold text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.02)]',
                        ].join(' ')}
                    >
                        <span className="max-w-[260px] truncate">{t}</span>
                    </span>
                ))}
                {more > 0 ? (
                    <span
                        className={[
                            'inline-flex items-center rounded-full',
                            'border border-slate-200 bg-slate-50',
                            compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[11px]',
                            'font-semibold text-slate-600',
                        ].join(' ')}
                    >
                        +{more} more
                    </span>
                ) : null}
            </div>

            {!compact ? (
                <div className="mt-1 text-[11px] text-slate-500">
                    Total tests: <span className="font-semibold text-slate-700">{Array.isArray(items) ? items.length : 0}</span>
                </div>
            ) : null}
        </div>
    )
})

/* -------------------- memo wrappers -------------------- */
const MemoPatientPicker = memo(PatientPicker)
const MemoLabTestPicker = memo(LabTestPicker)

/* -------------------- UI blocks -------------------- */

const PriorityPills = memo(function PriorityPills({ value, onChange }) {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
                {PRIORITY_OPTS.map((o) => {
                    const active = value === o.key
                    return (
                        <button
                            key={o.key}
                            type="button"
                            onClick={() => onChange(o.key)}
                            className={`group rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99] ${active
                                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                                : 'bg-slate-50 text-slate-800 hover:bg-slate-100'
                                }`}
                        >
                            <div className="text-sm font-semibold">{o.label}</div>
                            <div className={`mt-0.5 text-[11px] ${active ? 'text-white/75' : 'text-slate-500'}`}>
                                {o.hint}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
})
/* -------------------- Encounter context dropdown (auto-load from billing) -------------------- */

function _asStr(v) {
    if (v === null || v === undefined) return ''
    return String(v).trim()
}

function _normalizeList(data) {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    if (Array.isArray(data?.results)) return data.results
    if (Array.isArray(data?.rows)) return data.rows
    return []
}

function _pickEncounterType(x) {
    const raw =
        x?.encounter_type ??
        x?.context_type ??
        x?.type ??
        x?.kind ??
        x?.module ??
        x?.encounterType ??
        x?.contextType

    const t = _asStr(raw).toLowerCase()

    if (t === 'opd' || t === 'op' || t === 'visit' || t === 'outpatient') return 'opd'
    if (t === 'ipd' || t === 'ip' || t === 'admission' || t === 'inpatient') return 'ipd'

    // heuristic fallback
    if (x?.visit_id || x?.visitId) return 'opd'
    if (x?.admission_id || x?.admissionId) return 'ipd'
    if (x?.ward_name || x?.bed_label || x?.room_name) return 'ipd'

    return '' // unknown
}

function _pickEncounterId(x) {
    return (
        x?.encounter_id ??
        x?.context_id ??
        x?.visit_id ??
        x?.visitId ??
        x?.admission_id ??
        x?.admissionId ??
        x?.id ??
        null
    )
}

function _pickEncounterWhen(x) {
    return (
        x?.service_date ??
        x?.visit_date ??
        x?.admission_date ??
        x?.admitted_at ??
        x?.started_at ??
        x?.created_at ??
        x?.createdAt ??
        null
    )
}

function _pickEncounterStatus(x) {
    return x?.status ?? x?.visit_status ?? x?.admission_status ?? x?.state ?? null
}

function _opdTitle(v) {
    const id = _pickEncounterId(v)
    const dt = _pickEncounterWhen(v)
    const no = v?.visit_no || v?.visitNo || v?.encounter_no || v?.encounterNo || v?.token_no || v?.tokenNo
    const left = no ? `OPD ${_asStr(no)}` : id ? `OPD #${id}` : 'OPD'
    const right = dt ? formatIST(dt) : null
    return right ? `${left} • ${right}` : left
}

function _ipdTitle(a) {
    const id = _pickEncounterId(a)
    const dt = _pickEncounterWhen(a)
    const no = a?.admission_no || a?.admissionNo || a?.ip_no || a?.ipNo || a?.encounter_no || a?.encounterNo
    const left = no ? `IPD ${_asStr(no)}` : id ? `IPD #${id}` : 'IPD'
    const right = dt ? formatIST(dt) : null
    return right ? `${left} • ${right}` : left
}

function _opdSubtitle(v) {
    const dept = v?.department_name || v?.department || v?.dept_name
    const doc = v?.doctor_name || v?.doctor || v?.consultant_name
    const cause = v?.chief_complaint || v?.complaint || v?.cause || v?.reason
    return [dept, doc, cause].filter(Boolean).map(String).slice(0, 2).join(' • ')
}

function _ipdSubtitle(a) {
    const ward = a?.ward_name || a?.ward || a?.wardName
    const room = a?.room_name || a?.room || a?.roomName
    const bed = a?.bed_label || a?.bed || a?.bedLabel
    return [ward, room, bed].filter(Boolean).map(String).slice(0, 2).join(' • ')
}

function _msForSort(x) {
    const dt = _pickEncounterWhen(x)
    const d = parseBackendDate(dt)
    return d ? d.getTime() : 0
}

/** Premium searchable dropdown (no external libs) */
const EncounterIdDropdown = memo(function EncounterIdDropdown({
    disabled,
    loading,
    placeholder,
    value, // string/number
    options, // [{ id, title, subtitle, badge, searchText }]
    onSelect,
    onRefresh,
}) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const wrapRef = useRef(null)

    const selected = useMemo(() => {
        const v = value == null ? '' : String(value)
        return options.find((o) => String(o.id) === v) || null
    }, [options, value])

    const filtered = useMemo(() => {
        const s = (q || '').trim().toLowerCase()
        if (!s) return options
        return options.filter((o) => {
            const hay = `${o.searchText || ''} ${o.title || ''} ${o.subtitle || ''} ${o.badge || ''} ${o.id || ''}`.toLowerCase()
            return hay.includes(s)
        })
    }, [options, q])

    useEffect(() => {
        if (!open) return
        const onDown = (e) => {
            if (!wrapRef.current) return
            if (!wrapRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [open])

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((v) => !v)}
                className={[
                    'h-10 w-full rounded-2xl border px-3 text-left text-sm shadow-sm outline-none',
                    'flex items-center justify-between gap-2',
                    disabled
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50',
                ].join(' ')}
            >
                <span className="min-w-0 truncate">
                    {selected?.title || placeholder}
                </span>
                <span className="text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                </span>
            </button>

            {open && !disabled && (
                <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search by ID / date / doctor / ward…"
                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={onRefresh}
                                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    <div className="max-h-72 overflow-auto p-1">
                        {loading ? (
                            <div className="p-4 text-xs text-slate-500">Loading encounters…</div>
                        ) : filtered.length === 0 ? (
                            <div className="p-4 text-xs text-slate-500">No encounters found. Use manual ID.</div>
                        ) : (
                            filtered.slice(0, 80).map((o, idx) => {
                                const isSelected = String(o.id) === String(value || '')
                                const isLatest = idx === 0
                                return (
                                    <button
                                        key={`${String(o.id)}-${idx}`}
                                        type="button"
                                        onClick={() => {
                                            onSelect(String(o.id))
                                            setOpen(false)
                                        }}
                                        className={[
                                            'w-full rounded-2xl px-3 py-2 text-left transition',
                                            isSelected ? 'bg-slate-50 ring-1 ring-slate-200' : 'hover:bg-slate-50',
                                        ].join(' ')}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate font-semibold text-slate-900">{o.title}</div>
                                                {o.subtitle ? (
                                                    <div className="mt-0.5 truncate text-[11px] text-slate-500">{o.subtitle}</div>
                                                ) : null}
                                            </div>

                                            <div className="flex shrink-0 items-center gap-2">
                                                {o.badge ? (
                                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                                        {_asStr(o.badge).toUpperCase()}
                                                    </span>
                                                ) : null}

                                                {isLatest ? (
                                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                                        Latest
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-1 text-[11px] text-slate-500">ID: {o.id}</div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
})

/** Full picker: type + auto loaded ID dropdown + manual input (billing endpoint) */
const EncounterContextPicker = memo(function EncounterContextPicker({
    patientId,
    valueType,
    valueId,
    onType,
    onId,
    disabled,
}) {
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [all, setAll] = useState([])
    const abortRef = useRef(null)

    const refresh = useCallback(async () => {
        if (!patientId) {
            setAll([])
            return
        }
        abortRef.current?.abort?.()
        const ac = new AbortController()
        abortRef.current = ac

        setLoading(true)
        setErr('')
        try {
            const res = await listPatientEncounters(patientId, { limit: 100 }, { signal: ac.signal })
            const raw = _normalizeList(res?.data)

            const safe = Array.isArray(raw) ? raw : []
            // sort by date desc, then id desc
            safe.sort((a, b) => {
                const dm = _msForSort(b) - _msForSort(a)
                if (dm !== 0) return dm
                const ai = Number(_pickEncounterId(a) || 0)
                const bi = Number(_pickEncounterId(b) || 0)
                return bi - ai
            })

            setAll(safe)
        } catch (e) {
            if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
            console.error(e)
            setAll([])
            setErr('Failed to load encounters. You can still enter ID manually.')
        } finally {
            setLoading(false)
        }
    }, [patientId])

    // auto-load when patient changes
    useEffect(() => {
        setErr('')
        setAll([])
        if (!patientId) return
        refresh()
        return () => abortRef.current?.abort?.()
    }, [patientId, refresh])

    const opdOptions = useMemo(() => {
        return (all || [])
            .filter((x) => _pickEncounterType(x) === 'opd')
            .map((x) => {
                const id = _pickEncounterId(x)
                if (!id) return null
                const badge = _pickEncounterStatus(x)
                return {
                    id,
                    title: _opdTitle(x),
                    subtitle: _opdSubtitle(x),
                    badge,
                    searchText: `${id} opd ${_asStr(badge)} ${_asStr(x?.department_name)} ${_asStr(x?.doctor_name)} ${_asStr(x?.chief_complaint)}`,
                }
            })
            .filter(Boolean)
    }, [all])

    const ipdOptions = useMemo(() => {
        return (all || [])
            .filter((x) => _pickEncounterType(x) === 'ipd')
            .map((x) => {
                const id = _pickEncounterId(x)
                if (!id) return null
                const badge = _pickEncounterStatus(x)
                return {
                    id,
                    title: _ipdTitle(x),
                    subtitle: _ipdSubtitle(x),
                    badge,
                    searchText: `${id} ipd ${_asStr(badge)} ${_asStr(x?.ward_name)} ${_asStr(x?.room_name)} ${_asStr(x?.bed_label)}`,
                }
            })
            .filter(Boolean)
    }, [all])

    const latestOpd = opdOptions[0] || null
    const latestIpd = ipdOptions[0] || null

    const recentAll = useMemo(() => {
        const merged = []
        if (latestOpd) merged.push({ type: 'opd', ...latestOpd })
        if (latestIpd) merged.push({ type: 'ipd', ...latestIpd })

        // if both exist, pick true latest by parsing the date again from title is unreliable
        // better: just keep both as quick picks (premium UX).
        return merged
    }, [latestOpd, latestIpd])

    // smart prefill: if nothing chosen yet, select latest available (prefer whichever exists)
    useEffect(() => {
        if (!patientId) return
        if (valueType || valueId) return
        if (latestOpd && !latestIpd) {
            onType('opd')
            onId(String(latestOpd.id))
            return
        }
        if (latestIpd && !latestOpd) {
            onType('ipd')
            onId(String(latestIpd.id))
            return
        }
        // if both exist, keep unselected but show quick picks (avoid wrong auto-choice)
    }, [patientId, valueType, valueId, latestOpd, latestIpd, onType, onId])

    // when user selects type and id is empty, auto-pick latest from that type
    useEffect(() => {
        if (!valueType) return
        if (valueId) return
        const pick = valueType === 'opd' ? latestOpd : latestIpd
        if (pick?.id) onId(String(pick.id))
    }, [valueType, valueId, latestOpd, latestIpd, onId])

    const typeDisabled = disabled || !patientId
    const activeOptions = valueType === 'ipd' ? ipdOptions : valueType === 'opd' ? opdOptions : []

    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-900">Encounter context (Required)</div>
                    <div className="mt-1 text-xs text-slate-500">
                        Auto-loads encounters from billing endpoint for the selected patient.
                    </div>
                </div>

                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    <Link2 className="h-3.5 w-3.5" />
                    {contextText(valueType, valueId)}
                </span>
            </div>

            {/* Quick picks (premium) */}
            {patientId && (latestOpd || latestIpd) ? (
                <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold text-slate-600">Quick pick (latest)</div>
                        <button
                            type="button"
                            onClick={refresh}
                            disabled={disabled}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {latestOpd ? (
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                    onType('opd')
                                    onId(String(latestOpd.id))
                                }}
                                className={[
                                    'rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99]',
                                    valueType === 'opd' ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white hover:bg-slate-50',
                                    disabled ? 'opacity-60 cursor-not-allowed' : '',
                                ].join(' ')}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Stethoscope className="h-4 w-4 text-slate-700" />
                                        <div className="text-xs font-semibold text-slate-900">Latest OPD</div>
                                    </div>
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                        Pick
                                    </span>
                                </div>
                                <div className="mt-1 text-[11px] text-slate-600 truncate">{latestOpd.title}</div>
                                {latestOpd.subtitle ? (
                                    <div className="mt-0.5 text-[11px] text-slate-500 truncate">{latestOpd.subtitle}</div>
                                ) : null}
                            </button>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                                No OPD encounters found
                            </div>
                        )}

                        {latestIpd ? (
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                    onType('ipd')
                                    onId(String(latestIpd.id))
                                }}
                                className={[
                                    'rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99]',
                                    valueType === 'ipd' ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white hover:bg-slate-50',
                                    disabled ? 'opacity-60 cursor-not-allowed' : '',
                                ].join(' ')}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <BedDouble className="h-4 w-4 text-slate-700" />
                                        <div className="text-xs font-semibold text-slate-900">Latest IPD</div>
                                    </div>
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                        Pick
                                    </span>
                                </div>
                                <div className="mt-1 text-[11px] text-slate-600 truncate">{latestIpd.title}</div>
                                {latestIpd.subtitle ? (
                                    <div className="mt-0.5 text-[11px] text-slate-500 truncate">{latestIpd.subtitle}</div>
                                ) : null}
                            </button>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                                No IPD encounters found
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {/* Type */}
                <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Context type</label>

                    <div className="grid grid-cols-2 gap-2">
                        {CONTEXT_OPTS.map((o) => {
                            const Icon = o.icon
                            const active = valueType === o.key
                            const count = o.key === 'opd' ? opdOptions.length : ipdOptions.length

                            // small latest preview
                            const preview = o.key === 'opd' ? latestOpd?.title : latestIpd?.title

                            return (
                                <button
                                    key={o.key}
                                    type="button"
                                    disabled={typeDisabled}
                                    onClick={() => {
                                        onType(o.key)
                                        onId('') // reset ID when switching type (auto-pick latest via effect)
                                    }}
                                    className={[
                                        'rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99]',
                                        active
                                            ? 'border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-900/15'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                                        typeDisabled ? 'opacity-60 cursor-not-allowed' : '',
                                    ].join(' ')}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-700'}`} />
                                            <div className="text-sm font-semibold">{o.label}</div>
                                        </div>
                                        <span
                                            className={[
                                                'rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                                                active ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-slate-50 text-slate-700',
                                            ].join(' ')}
                                        >
                                            {count}
                                        </span>
                                    </div>

                                    <div className={`mt-1 text-[11px] ${active ? 'text-white/75' : 'text-slate-500'}`}>
                                        {preview ? `Latest: ${preview}` : o.hint}
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500">
                        Loaded: <span className="font-semibold text-slate-700">{(all || []).length}</span> encounters
                    </div>
                </div>

                {/* Auto dropdown + manual ID */}
                <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Context ID ({valueType === 'ipd' ? 'Admission' : 'Visit'})
                    </label>

                    <EncounterIdDropdown
                        disabled={disabled || !patientId || !valueType}
                        loading={loading}
                        value={valueId}
                        options={activeOptions}
                        onSelect={(idStr) => onId(idStr)}
                        onRefresh={refresh}
                        placeholder={
                            !valueType
                                ? 'Select context type first'
                                : loading
                                    ? 'Loading…'
                                    : activeOptions.length
                                        ? 'Select from list…'
                                        : 'No records (enter manually)…'
                        }
                    />

                    <div className="mt-2 grid gap-2">
                        <div className="text-[11px] text-slate-500">Or enter manually:</div>
                        <input
                            type="number"
                            inputMode="numeric"
                            disabled={disabled || !patientId || !valueType}
                            placeholder={
                                valueType
                                    ? valueType === 'ipd'
                                        ? 'Enter IPD Admission ID'
                                        : 'Enter OPD Visit ID'
                                    : 'Select context type first'
                            }
                            value={valueId || ''}
                            onChange={(e) => onId(e.target.value)}
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                    </div>

                    {err ? (
                        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                            {err}
                        </div>
                    ) : (
                        <div className="mt-2 text-[11px] text-slate-500">
                            Tip: pick the latest encounter for correct billing/finalize mapping.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
})


/* -------------------- Drawer -------------------- */

const CreateOrderDrawer = memo(function CreateOrderDrawer({
    onClose,
    onCreate,
    createSaving,

    patientId,
    patientMeta,
    setPatient,

    contextType,
    contextId,
    setContextType,
    setContextId,

    testIds,
    testMeta,
    setTests,

    priority,
    setPriority,
}) {
    const drawerRef = useRef(null)
    const lastFocusRef = useRef(null)
    const didAutofocusRef = useRef(false)

    const [step, setStep] = useState('patient') // patient | tests | review

    const onCloseEv = useEvent(onClose)
    const onCreateEv = useEvent(onCreate)
    const setPatientEv = useEvent(setPatient)
    const setContextTypeEv = useEvent(setContextType)
    const setContextIdEv = useEvent(setContextId)
    const setTestsEv = useEvent(setTests)
    const setPriorityEv = useEvent(setPriority)

    const stepIndex = useMemo(
        () => Math.max(0, STEPS.findIndex((s) => s.key === step)),
        [step]
    )

    const canNext = useMemo(() => {
        if (step === 'patient') return !!patientId && !!contextType && !!contextId
        if (step === 'tests') return Array.isArray(testIds) && testIds.length > 0
        return true
    }, [step, patientId, contextType, contextId, testIds])

    const nextLabel = useMemo(() => {
        if (step === 'patient') return 'Continue'
        if (step === 'tests') return 'Review'
        return 'Create Order'
    }, [step])

    const primaryDisabledReason = useMemo(() => {
        if (step !== 'review') return null
        if (!patientId) return 'Select patient'
        if (!contextType || !contextId) return 'Select encounter context + ID'
        if (!testIds?.length) return 'Select at least 1 test'
        return null
    }, [step, patientId, contextType, contextId, testIds])

    const patientChip = useMemo(() => patientLabel(patientMeta, patientId), [patientMeta, patientId])

    const isDirty = useMemo(() => {
        return (
            !!patientId ||
            !!contextType ||
            !!contextId ||
            (testIds?.length || 0) > 0 ||
            (priority || 'routine') !== 'routine'
        )
    }, [patientId, contextType, contextId, testIds, priority])

    const requestClose = useCallback(() => {
        if (createSaving) return
        if (isDirty) {
            const ok = window.confirm('Discard this new order draft?')
            if (!ok) return
        }
        onCloseEv()
    }, [createSaving, isDirty, onCloseEv])

    const removeTest = useCallback(
        (id) => {
            const next = (testIds || []).filter((x) => String(x) !== String(id))
            setTestsEv(next)
        },
        [testIds, setTestsEv]
    )

    const clearForm = useCallback(() => {
        if (createSaving) return
        setPatientEv(null)
        setContextTypeEv('')
        setContextIdEv('')
        setTestsEv([])
        setPriorityEv('routine')
        setStep('patient')
    }, [createSaving, setPatientEv, setContextTypeEv, setContextIdEv, setTestsEv, setPriorityEv])

    const goBack = useCallback(() => {
        if (createSaving) return
        if (step === 'review') return setStep('tests')
        if (step === 'tests') return setStep('patient')
    }, [createSaving, step])

    const goNext = useCallback(() => {
        if (createSaving) return
        if (step === 'patient') {
            if (!patientId) return toast.error('Select a patient')
            if (!contextType || !contextId) return toast.error('Select encounter context type and ID')
            setStep('tests')
            return
        }
        if (step === 'tests') {
            if (!testIds?.length) return toast.error('Select at least one test')
            setStep('review')
            return
        }
        onCreateEv()
    }, [createSaving, step, patientId, contextType, contextId, testIds, onCreateEv])

    useEffect(() => {
        lastFocusRef.current = document.activeElement
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const raf = requestAnimationFrame(() => {
            if (didAutofocusRef.current) return
            didAutofocusRef.current = true
            const box = drawerRef.current
            if (!box) return
            const el =
                box.querySelector(
                    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
                ) || null
            el?.focus?.()
        })

        const onKeyDownCapture = (ev) => {
            const box = drawerRef.current
            if (!box) return

            if (ev.key === 'Escape') {
                ev.preventDefault()
                requestClose()
                return
            }

            if (ev.key !== 'Tab') return
            const focusables = Array.from(
                box.querySelectorAll(
                    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter((el) => el.offsetParent !== null)

            if (!focusables.length) return
            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            const active = document.activeElement

            if (ev.shiftKey) {
                if (active === first || !box.contains(active)) {
                    ev.preventDefault()
                    last.focus()
                }
            } else {
                if (active === last) {
                    ev.preventDefault()
                    first.focus()
                }
            }
        }

        document.addEventListener('keydown', onKeyDownCapture, true)

        return () => {
            cancelAnimationFrame(raf)
            document.removeEventListener('keydown', onKeyDownCapture, true)
            document.body.style.overflow = prevOverflow
            try {
                lastFocusRef.current?.focus?.()
            } catch { }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm" onClick={requestClose} />

            <div className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[620px]">
                <div
                    ref={drawerRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="New Lab Order"
                    className={[
                        'h-[92dvh] sm:h-full',
                        'flex flex-col',
                        'rounded-t-3xl sm:rounded-none sm:rounded-l-3xl',
                        'border border-slate-200 bg-white shadow-2xl overflow-hidden',
                    ].join(' ')}
                >
                    {/* Header */}
                    <div className="relative shrink-0 border-b border-slate-200">
                        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-20%,rgba(15,23,42,0.10),transparent_55%),radial-gradient(900px_circle_at_90%_10%,rgba(2,132,199,0.10),transparent_55%)]" />
                        <div className="relative px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-9 w-9 rounded-2xl border border-slate-200 bg-white shadow-sm grid place-items-center">
                                        <FlaskConical className="h-4 w-4 text-slate-900" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-base font-semibold text-slate-900">New Lab Order</div>
                                        <div className="text-xs text-slate-500">Patient → Context → Tests → Review</div>
                                    </div>
                                </div>

                                <button
                                    onClick={requestClose}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-50"
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4 text-slate-600" />
                                </button>
                            </div>

                            {/* Stepper */}
                            <div className="mt-4 grid grid-cols-3 gap-2">
                                {STEPS.map((s, idx) => {
                                    const active = idx === stepIndex
                                    const done = idx < stepIndex
                                    return (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() => {
                                                if (createSaving) return
                                                if (idx <= stepIndex) setStep(s.key)
                                                else if (s.key === 'tests' && patientId && contextType && contextId) setStep('tests')
                                                else if (s.key === 'review' && patientId && contextType && contextId && testIds?.length) setStep('review')
                                            }}
                                            className={`rounded-2xl border px-3 py-2 text-left transition ${active
                                                ? 'border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-900/15'
                                                : done
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs font-semibold">{s.title}</div>
                                                {done ? <CheckCircle2 className="h-4 w-4" /> : null}
                                            </div>
                                            <div className={`mt-0.5 text-[11px] ${active ? 'text-white/75' : 'text-slate-500'}`}>
                                                Step {idx + 1}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Summary chips */}
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                                    <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                                    <span className="truncate">
                                        Patient: <span className="font-semibold">{patientChip}</span>
                                    </span>
                                </span>

                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                                    Context: <span className="font-semibold">{contextText(contextType, contextId)}</span>
                                </span>

                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                                    Tests: <span className="font-semibold">{testIds?.length || 0}</span>
                                </span>

                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 capitalize">
                                    Priority: <span className="font-semibold">{priority}</span>
                                </span>

                                <button
                                    type="button"
                                    onClick={clearForm}
                                    disabled={createSaving}
                                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                        {step === 'patient' && (
                            <div className="space-y-4">
                                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">Select patient</div>
                                            <div className="mt-1 text-xs text-slate-500">Search by UHID / phone / name.</div>
                                        </div>
                                        {patientId ? (
                                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                                                Selected
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-4">
                                        <MemoPatientPicker value={patientId} onChange={setPatientEv} />
                                    </div>

                                    {patientId ? (
                                        <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                                            <span className="font-semibold">Chosen:</span> {patientChip}
                                        </div>
                                    ) : null}
                                </div>

                                {/* ✅ NEW: Encounter Context */}
                                <EncounterContextPicker
                                    patientId={patientId}
                                    valueType={contextType}
                                    valueId={contextId}
                                    onType={(t) => setContextTypeEv(t)}
                                    onId={(v) => setContextIdEv(v)}
                                    disabled={!patientId || createSaving}
                                />


                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                                    Tip: Select correct OPD/IPD context to avoid finalize/billing errors.
                                </div>
                            </div>
                        )}

                        {step === 'tests' && (
                            <div className="space-y-4">
                                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-slate-900">Add tests</div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                Patient: <span className="font-semibold text-slate-700">{patientChip}</span>
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                Context: <span className="font-semibold text-slate-700">{contextText(contextType, contextId)}</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Selected: <span className="font-semibold text-slate-800">{testIds?.length || 0}</span>
                                        </div>
                                    </div>

                                    {testIds?.length ? (
                                        <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-[11px] font-semibold text-slate-600">Selected tests</div>
                                                <button
                                                    type="button"
                                                    onClick={() => setTestsEv([])}
                                                    disabled={createSaving}
                                                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 underline disabled:opacity-60"
                                                >
                                                    Clear all
                                                </button>
                                            </div>

                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {(testMeta && Array.isArray(testMeta) && testMeta.length
                                                    ? testMeta.map((t) => ({ id: testId(t), label: testLabel(t) }))
                                                    : testIds.map((id) => ({ id, label: `Test #${id}` }))
                                                )
                                                    .filter((x) => x.id !== null && x.id !== undefined)
                                                    .slice(0, 12)
                                                    .map((x) => (
                                                        <span
                                                            key={String(x.id)}
                                                            className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700"
                                                        >
                                                            <span className="truncate">{x.label}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeTest(x.id)}
                                                                disabled={createSaving}
                                                                className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-60"
                                                                aria-label="Remove"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </span>
                                                    ))}

                                                {(testIds?.length || 0) > 12 ? (
                                                    <span className="text-[11px] text-slate-500">
                                                        +{(testIds?.length || 0) - 12} more
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="mt-4 -mx-2 sm:mx-0">
                                        <div className="px-2 sm:px-0">
                                            <MemoLabTestPicker value={testIds} onChange={setTestsEv} />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="text-sm font-semibold text-slate-900">Priority</div>
                                    <div className="mt-1 text-xs text-slate-500">This influences queue handling in LIS workflow.</div>
                                    <div className="mt-3">
                                        <PriorityPills value={priority} onChange={setPriorityEv} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 'review' && (
                            <div className="space-y-4">
                                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="text-sm font-semibold text-slate-900">Review & confirm</div>
                                    <div className="mt-1 text-xs text-slate-500">Verify details before creating the order.</div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="text-[11px] font-semibold text-slate-600">Patient</div>
                                            <div className="mt-1 text-sm font-semibold text-slate-900">{patientChip}</div>
                                            <button
                                                type="button"
                                                onClick={() => setStep('patient')}
                                                disabled={createSaving}
                                                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                            >
                                                Edit patient
                                            </button>
                                        </div>

                                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="text-[11px] font-semibold text-slate-600">Encounter context</div>
                                            <div className="mt-1 text-sm font-semibold text-slate-900">{contextText(contextType, contextId)}</div>
                                            <button
                                                type="button"
                                                onClick={() => setStep('patient')}
                                                disabled={createSaving}
                                                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                            >
                                                Edit context
                                            </button>
                                        </div>

                                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                                            <div className="text-[11px] font-semibold text-slate-600">Tests</div>
                                            <div className="mt-1 text-sm font-semibold text-slate-900">{testIds?.length || 0} selected</div>
                                            <button
                                                type="button"
                                                onClick={() => setStep('tests')}
                                                disabled={createSaving}
                                                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                            >
                                                Edit tests
                                            </button>
                                        </div>
                                    </div>

                                    {primaryDisabledReason ? (
                                        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                                            Missing: <span className="font-semibold">{primaryDisabledReason}</span>
                                        </div>
                                    ) : (
                                        <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                                            Looks good. You can create the order now.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                onClick={requestClose}
                                disabled={createSaving}
                                className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>

                            <div className="flex w-full sm:w-auto gap-2">
                                <button
                                    type="button"
                                    onClick={goBack}
                                    disabled={createSaving || step === 'patient'}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </button>

                                <button
                                    type="button"
                                    onClick={goNext}
                                    disabled={createSaving || !canNext || (step === 'review' && !!primaryDisabledReason)}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {createSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Creating…
                                        </>
                                    ) : (
                                        <>
                                            {nextLabel}
                                            <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="mt-2 text-[11px] text-slate-500">
                            Keyboard: <span className="font-semibold">ESC</span> to close, <span className="font-semibold">Tab</span> to move.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
})

/* -------------------- Page Shell -------------------- */

const Shell = memo(function Shell({ children }) {
    return (
        <div className="min-h-[calc(100vh-56px)] w-full">
            <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
                <div className="rounded-3xl border border-slate-200/70 bg-white/70 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                    <div className="p-4 sm:p-6">{children}</div>
                </div>
            </div>
        </div>
    )
})

/* -------------------- Main Page -------------------- */

export default function Orders() {
    const [q, setQ] = useState('')
    const qDebounced = useDebounced(q, 250)

    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [createOpen, setCreateOpen] = useState(false)
    const [createSaving, setCreateSaving] = useState(false)

    // patient + meta
    const [patientId, setPatientId] = useState(null)
    const [patientMeta, setPatientMeta] = useState(null)

    // ✅ NEW: encounter context
    const [contextType, setContextType] = useState('') // 'opd' | 'ipd'
    const [contextId, setContextId] = useState('') // string input, convert on submit

    // tests + meta
    const [testIds, setTestIds] = useState([])
    const [testMeta, setTestMeta] = useState(null)

    const [priority, setPriority] = useState('routine')

    // filters
    const [filtersOpen, setFiltersOpen] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')

    const navigate = useNavigate()
    const abortRef = useRef(null)

    const openDrawer = useCallback(() => setCreateOpen(true), [])
    const closeDrawer = useCallback(() => setCreateOpen(false), [])

    const fetchRows = useCallback(async () => {
        abortRef.current?.abort?.()
        const ac = new AbortController()
        abortRef.current = ac

        setLoading(true)
        try {
            const { data } = await listLisOrders({ page_size: 200, signal: ac.signal })
            const items = Array.isArray(data) ? data : data?.items || []
            setRows(items)
        } catch (e) {
            if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
            console.error(e)
            toast.error('Failed to load orders')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRows()
    }, [fetchRows])

    const clearFilters = useCallback(() => {
        setStatusFilter('all')
        setPriorityFilter('all')
        setFromDate('')
        setToDate('')
    }, [])

    // ✅ stable setters
    const setPatientStable = useCallback((val) => {
        if (val && typeof val === 'object') {
            const id = pickId(val)
            setPatientId((prev) => (String(prev) === String(id) ? prev : id))
            setPatientMeta(val)
            // ✅ reset context when patient changes
            setContextType('')
            setContextId('')
            return
        }
        setPatientId((prev) => (String(prev) === String(val) ? prev : val))
        setPatientMeta(null)
        setContextType('')
        setContextId('')
    }, [])

    const setTestsStable = useCallback((val) => {
        if (Array.isArray(val) && val.length && typeof val[0] === 'object') {
            const ids = val.map((x) => testId(x)).filter((x) => x !== null && x !== undefined)
            setTestIds((prev) => (shallowArrayEq(prev, ids) ? prev : ids))
            setTestMeta(val)
            return
        }
        const ids = Array.isArray(val) ? val : []
        setTestIds((prev) => (shallowArrayEq(prev, ids) ? prev : ids))
        setTestMeta(null)
    }, [])

    const filteredRows = useMemo(() => {
        const search = (qDebounced || '').trim().toLowerCase()

        return rows.filter((o) => {
            if (search) {
                const p = o.patient || {}
                const fullName =
                    (p.full_name || '').trim() ||
                    `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim()
                const uhid = p.uhid || ''
                const labNo = o.display_no || formatOrderNo(o.id)
                const tests = getOrderItems(o)
                const testsText = Array.isArray(tests) ? tests.slice(0, 10).map(testChipText).join(' ') : ''
                const haystack = `${fullName} ${uhid} ${labNo} ${testsText}`.toLowerCase()
                if (!haystack.includes(search)) return false
            }

            if (statusFilter !== 'all') {
                if ((o.status || '').toLowerCase() !== statusFilter) return false
            }

            if (priorityFilter !== 'all') {
                if ((o.priority || '').toLowerCase() !== priorityFilter) return false
            }

            if (fromDate || toDate) {
                const created = o.created_at || o.createdAt
                const createdYmd = ymdInTz(created)
                if (!createdYmd) return false

                if (fromDate && createdYmd < fromDate) return false
                if (toDate && createdYmd > toDate) return false
            }

            return true
        })
    }, [rows, qDebounced, statusFilter, priorityFilter, fromDate, toDate])

    const total = filteredRows.length

    const stats = useMemo(() => {
        const c = { ordered: 0, collected: 0, in_progress: 0, validated: 0, reported: 0 }
        for (const o of filteredRows) {
            const s = (o.status || '').toLowerCase()
            if (c[s] !== undefined) c[s] += 1
        }
        const urgent = filteredRows.filter((o) => (o.priority || '').toLowerCase() !== 'routine').length
        return { ...c, urgent }
    }, [filteredRows])

    const onCreate = useCallback(async () => {
        const ctxIdNum = contextId ? Number(contextId) : null
        if (!patientId || testIds.length === 0) {
            toast.error('Select patient and at least one test')
            return
        }
        if (!contextType || !ctxIdNum || Number.isNaN(ctxIdNum)) {
            toast.error('Select encounter context type and enter a valid Context ID')
            return
        }

        setCreateSaving(true)
        try {
            // ✅ IMPORTANT: pass context_type + context_id (fix finalize/billing context missing)
            const { data } = await createLisOrder({
                patient_id: patientId,
                context_type: contextType,
                context_id: ctxIdNum,
                priority,
                test_ids: testIds,
            })

            toast.success('Order created')
            closeDrawer()

            // reset
            setPatientStable(null)
            setTestsStable([])
            setPriority('routine')
            setContextType('')
            setContextId('')

            const orderId = data?.id || data?.order_id
            if (orderId) navigate(`/lab/orders/${orderId}`)
            else fetchRows()
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Create failed')
        } finally {
            setCreateSaving(false)
        }
    }, [patientId, testIds, priority, contextType, contextId, navigate, fetchRows, closeDrawer, setPatientStable, setTestsStable])

    return (
        <Shell>
            {/* HEADER */}
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl border border-slate-200 bg-white shadow-sm grid place-items-center">
                        <FlaskConical className="h-5 w-5 text-slate-900" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Lab Orders</h1>
                        <p className="text-xs sm:text-sm text-slate-500">Create, track, and finalize LIS orders (NABH aligned)</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchRows}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <PermGate anyOf={['lab.orders.create', 'orders.lab.create']}>
                        <button
                            onClick={openDrawer}
                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 active:scale-[0.99]"
                        >
                            <Plus className="h-4 w-4" />
                            New Order
                        </button>
                    </PermGate>
                </div>
            </header>

            {/* SEARCH + FILTERS */}
            <section className="mt-4 rounded-3xl border border-slate-200/70 bg-white p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-2xl">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-9 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            placeholder="Search UHID / patient / Lab No / test…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                        {q ? (
                            <button
                                onClick={() => setQ('')}
                                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-100"
                                aria-label="Clear search"
                            >
                                <X className="h-4 w-4 text-slate-600" />
                            </button>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                        <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <Sparkles className="h-4 w-4 text-slate-500" />
                            Total: <span className="font-semibold text-slate-800">{total}</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setFiltersOpen((v) => !v)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <Filter className="h-4 w-4" />
                            Filters
                            {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {filtersOpen && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <div className="lg:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status</label>
                            <select
                                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All</option>
                                <option value="ordered">Ordered</option>
                                <option value="collected">Collected</option>
                                <option value="in_progress">In Progress</option>
                                <option value="validated">Validated</option>
                                <option value="reported">Reported</option>
                            </select>
                        </div>

                        <div className="lg:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Priority</label>
                            <select
                                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                value={priorityFilter}
                                onChange={(e) => setPriorityFilter(e.target.value)}
                            >
                                <option value="all">All</option>
                                <option value="routine">Routine</option>
                                <option value="urgent">Urgent</option>
                                <option value="stat">STAT</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">From</label>
                            <div className="relative">
                                <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <input
                                    type="date"
                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">To</label>
                            <div className="relative">
                                <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <input
                                    type="date"
                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-end justify-between sm:justify-end gap-3">
                            <button
                                type="button"
                                className="text-sm font-semibold text-slate-600 hover:text-slate-800 underline"
                                onClick={clearFilters}
                            >
                                Clear
                            </button>
                            <div className="text-xs text-slate-500">
                                Urgent/STAT: <span className="font-semibold text-slate-700">{stats.urgent}</span>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* LIST */}
            <section className="mt-4">
                {/* Mobile cards */}
                <div className="grid gap-3 md:hidden">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="h-4 w-28 rounded bg-slate-100" />
                                <div className="mt-3 h-4 w-64 rounded bg-slate-100" />
                                <div className="mt-3 h-6 w-44 rounded bg-slate-100" />
                                <div className="mt-3 h-8 w-full rounded-2xl bg-slate-100" />
                            </div>
                        ))
                    ) : filteredRows.length === 0 ? (
                        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                            No lab orders found.
                        </div>
                    ) : (
                        filteredRows.map((o) => {
                            const items = getOrderItems(o)
                            return (
                                <div
                                    key={o.id}
                                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs font-semibold text-slate-800">
                                            {o.display_no || formatOrderNo(o.id)}
                                        </div>
                                        <StatusBadge status={o.status} />
                                    </div>

                                    <div className="mt-2 text-sm">
                                        <PatientBadge patient={o.patient} patientId={o.patient_id} />
                                    </div>

                                    <TestChips items={items} max={3} />

                                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                                        <div className="space-y-1">
                                            <div>
                                                Priority:{' '}
                                                <span className="font-semibold capitalize text-slate-800">
                                                    {o.priority || 'routine'}
                                                </span>
                                            </div>
                                            <div>Created: {formatIST(o.created_at || o.createdAt)}</div>
                                        </div>

                                        <button
                                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                            onClick={() => navigate(`/lab/orders/${o.id}`)}
                                        >
                                            Open
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Lab No</th>
                                    <th className="px-4 py-3 text-left font-semibold">Patient</th>
                                    <th className="px-4 py-3 text-left font-semibold">Tests</th>
                                    <th className="px-4 py-3 text-left font-semibold">Priority</th>
                                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                                    <th className="px-4 py-3 text-left font-semibold">Created</th>
                                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {loading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-slate-100" /></td>
                                            <td className="px-4 py-3"><div className="h-4 w-72 rounded bg-slate-100" /></td>
                                            <td className="px-4 py-3"><div className="h-4 w-80 rounded bg-slate-100" /></td>
                                            <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-slate-100" /></td>
                                            <td className="px-4 py-3"><div className="h-6 w-28 rounded-full bg-slate-100" /></td>
                                            <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-slate-100" /></td>
                                            <td className="px-4 py-3 text-right"><div className="ml-auto h-9 w-24 rounded-2xl bg-slate-100" /></td>
                                        </tr>
                                    ))
                                ) : filteredRows.length === 0 ? (
                                    <tr className="border-t">
                                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                            No orders
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((o) => {
                                        const items = getOrderItems(o)
                                        return (
                                            <tr key={o.id} className="border-t hover:bg-slate-50/60">
                                                <td className="px-4 py-3">
                                                    <OrderBadge order={{ ...o, display_no: o.display_no || formatOrderNo(o.id) }} to={`/lab/orders/${o.id}`} />
                                                </td>

                                                <td className="px-4 py-3">
                                                    <PatientBadge patient={o.patient} patientId={o.patient_id} />
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="min-w-[320px] max-w-[520px]">
                                                        <TestChips items={items} max={2} compact />
                                                        <div className="mt-1 text-[11px] text-slate-500">
                                                            Total: <span className="font-semibold text-slate-700">{items?.length || 0}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3 capitalize">{o.priority || 'routine'}</td>
                                                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                                                <td className="px-4 py-3 text-sm text-slate-700">{formatIST(o.created_at || o.createdAt)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <Link
                                                        to={`/lab/orders/${o.id}`}
                                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        View
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>

                            {!loading && filteredRows.length > 0 ? (
                                <tfoot>
                                    <tr className="border-t bg-slate-50">
                                        <td colSpan={7} className="px-4 py-3 text-xs text-slate-500">
                                            Total: <span className="font-semibold text-slate-700">{total}</span>
                                        </td>
                                    </tr>
                                </tfoot>
                            ) : null}
                        </table>
                    </div>
                </div>
            </section>

            {createOpen ? (
                <CreateOrderDrawer
                    onClose={closeDrawer}
                    onCreate={onCreate}
                    createSaving={createSaving}
                    patientId={patientId}
                    patientMeta={patientMeta}
                    setPatient={setPatientStable}
                    contextType={contextType}
                    contextId={contextId}
                    setContextType={setContextType}
                    setContextId={setContextId}
                    testIds={testIds}
                    testMeta={testMeta}
                    setTests={setTestsStable}
                    priority={priority}
                    setPriority={setPriority}
                />
            ) : null}
        </Shell>
    )
}
