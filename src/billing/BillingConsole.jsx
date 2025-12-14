import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { createInvoice, getBillingMasters, listInvoices } from '../api/billing'
import PatientPicker from '../components/PatientPicker'

/* ----------------------------------------
   CONFIG
---------------------------------------- */
const BILLING_TABS = [
    { key: 'all', label: 'All' },
    { key: 'op_billing', label: 'OP Billing' },
    { key: 'ip_billing', label: 'IP Billing' },
    { key: 'ot', label: 'OT' },
    { key: 'lab', label: 'Lab' },
    { key: 'pharmacy', label: 'Pharmacy' },
    { key: 'radiology', label: 'Radiology' },
    { key: 'general', label: 'General' },
]

const STATUS_BADGE = {
    draft: 'bg-amber-50 text-amber-800 border-amber-200',
    finalized: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
    reversed: 'bg-slate-50 text-slate-700 border-slate-200',
}

const SORTS = [
    { key: 'created_at_desc', label: 'Newest first' },
    { key: 'created_at_asc', label: 'Oldest first' },
    { key: 'net_desc', label: 'Net: High → Low' },
    { key: 'net_asc', label: 'Net: Low → High' },
    { key: 'balance_desc', label: 'Balance: High → Low' },
    { key: 'balance_asc', label: 'Balance: Low → High' },
]

const PAGE_SIZES = [10, 20, 50, 100]

/* ----------------------------------------
   HELPERS
---------------------------------------- */
function money(x) {
    const n = Number(x || 0)
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function invNo(inv) {
    return inv?.invoice_number || inv?.invoice_uid || '—'
}

function pickUhid(p) {
    if (!p) return null
    return (
        p.uhid ||
        p.uhid_no ||
        p.patient_uid ||
        p.mrn ||
        p.uhidNumber ||
        p.uhidNumberText ||
        null
    )
}

function pickPhone(p) {
    if (!p) return null
    return p.phone || p.mobile || p.contact_no || p.contact || null
}

function pickName(p) {
    if (!p) return 'Patient'
    return (
        p.full_name ||
        p.name ||
        `${p.first_name || ''} ${p.last_name || ''}`.trim() ||
        'Patient'
    )
}

function safeDateTime(dt) {
    if (!dt) return ''
    const d = new Date(dt)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString()
}

function useDebounce(value, delay = 250) {
    const [v, setV] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return v
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n))
}

/* ----------------------------------------
   SMALL UI: Modal + Drawer (No shadcn)
---------------------------------------- */
function Modal({ open, title, onClose, children, footer }) {
    useEffect(() => {
        if (!open) return
        const onEsc = (e) => e.key === 'Escape' && onClose?.()
        document.addEventListener('keydown', onEsc)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onEsc)
            document.body.style.overflow = ''
        }
    }, [open, onClose])

    if (!open) return null
    return (
        <div className="fixed inset-0 z-[60]">
            <div
                className="absolute inset-0 bg-black/45"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className="absolute inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6">
                <div className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200">
                    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
                        <div>
                            <div className="text-base font-semibold text-slate-900">{title}</div>
                            <div className="text-[11px] text-slate-500">Press Esc to close</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-10 w-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="px-4 sm:px-6 py-4 max-h-[70vh] overflow-auto">
                        {children}
                    </div>

                    {footer ? (
                        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
                            {footer}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function MobileDrawer({ open, title, onClose, children }) {
    useEffect(() => {
        if (!open) return
        const onEsc = (e) => e.key === 'Escape' && onClose?.()
        document.addEventListener('keydown', onEsc)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onEsc)
            document.body.style.overflow = ''
        }
    }, [open, onClose])

    if (!open) return null
    return (
        <div className="fixed inset-0 z-[55] md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white border border-slate-200 shadow-2xl">
                <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-900">{title}</div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 w-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                    >
                        ✕
                    </button>
                </div>
                <div className="px-4 py-4 max-h-[80vh] overflow-auto">{children}</div>
            </div>
        </div>
    )
}

/* ----------------------------------------
   MAIN
---------------------------------------- */
export default function BillingConsole() {
    const nav = useNavigate()

    const [activeTab, setActiveTab] = useState('all')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [masters, setMasters] = useState({ doctors: [], credit_providers: [] })

    // filters
    const [q, setQ] = useState('')
    const qDebounced = useDebounce(q, 250)

    const [status, setStatus] = useState('all')
    const [patientId, setPatientId] = useState(null)
    const [patientObj, setPatientObj] = useState(null)

    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [minAmt, setMinAmt] = useState('')
    const [maxAmt, setMaxAmt] = useState('')

    // options
    const [sortKey, setSortKey] = useState('created_at_desc')
    const [pageSize, setPageSize] = useState(20)
    const [page, setPage] = useState(1)

    // realtime
    const [realtime, setRealtime] = useState(true)
    const [refreshEvery, setRefreshEvery] = useState(10)
    const timerRef = useRef(null)

    // mobile drawer
    const [filtersOpen, setFiltersOpen] = useState(false)

    // create invoice modal
    const [newOpen, setNewOpen] = useState(false)
    const [newForm, setNewForm] = useState({
        patient_id: null,
        billing_type: 'op_billing',
        context_type: 'opd',
        context_id: '',
        remarks: '',
    })

    useEffect(() => {
        ; (async () => {
            try {
                const { data } = await getBillingMasters()
                setMasters({
                    doctors: data?.doctors || [],
                    credit_providers: data?.credit_providers || [],
                })
            } catch (e) {
                console.error(e)
            }
        })()
    }, [])

    useEffect(() => {
        loadInvoices(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab])

    useEffect(() => {
        if (!realtime) {
            if (timerRef.current) clearInterval(timerRef.current)
            timerRef.current = null
            return
        }
        if (timerRef.current) clearInterval(timerRef.current)

        const sec = clamp(Number(refreshEvery) || 10, 5, 60)
        timerRef.current = setInterval(() => loadInvoices(true), sec * 1000)

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            timerRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [realtime, refreshEvery, activeTab])

    async function loadInvoices(silent) {
        if (!silent) setLoading(true)
        try {
            const params = {}
            if (activeTab !== 'all') params.billing_type = activeTab
            const { data } = await listInvoices(params)
            setRows(Array.isArray(data) ? data : [])
            if (!silent) setPage(1)
        } catch (e) {
            console.error(e)
            if (!silent) toast.error('Unable to load invoices')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    function clearFilters() {
        setQ('')
        setStatus('all')
        setPatientId(null)
        setPatientObj(null)
        setFromDate('')
        setToDate('')
        setMinAmt('')
        setMaxAmt('')
        setSortKey('created_at_desc')
        setPage(1)
    }

    function openInvoice(inv) {
        nav(`/billing/invoices/${inv.id}`)
    }

    async function handleCreateInvoice(e) {
        e.preventDefault()
        if (!newForm.patient_id) return toast.error('Please select patient')

        try {
            const payload = {
                patient_id: Number(newForm.patient_id),
                billing_type: newForm.billing_type || null,
                context_type: newForm.context_type || null,
                context_id: newForm.context_id ? Number(newForm.context_id) : null,
                remarks: newForm.remarks || null,
            }
            const { data } = await createInvoice(payload)
            toast.success('Invoice created')
            setNewOpen(false)
            setNewForm({
                patient_id: null,
                billing_type: 'op_billing',
                context_type: 'opd',
                context_id: '',
                remarks: '',
            })
            nav(`/billing/invoices/${data.id}`)
        } catch (e2) {
            console.error(e2)
            toast.error(e2?.response?.data?.detail || 'Create invoice failed')
        }
    }

    const filtered = useMemo(() => {
        const s = qDebounced.trim().toLowerCase()
        return (rows || [])
            .filter((r) => (status === 'all' ? true : String(r.status || '').toLowerCase() === status))
            .filter((r) => (patientId ? r.patient_id === patientId : true))
            .filter((r) => {
                if (!fromDate && !toDate) return true
                const dt = r.created_at ? new Date(r.created_at) : null
                if (!dt || Number.isNaN(dt.getTime())) return true
                const d = dt.toISOString().slice(0, 10)
                if (fromDate && d < fromDate) return false
                if (toDate && d > toDate) return false
                return true
            })
            .filter((r) => {
                const net = Number(r.net_total || 0)
                if (minAmt && net < Number(minAmt)) return false
                if (maxAmt && net > Number(maxAmt)) return false
                return true
            })
            .filter((r) => {
                if (!s) return true
                const p = r.patient || null
                const hay = `${invNo(r)} ${r.billing_type || ''} ${r.status || ''} ${pickName(p)} ${pickUhid(p) || ''} ${pickPhone(p) || ''}`.toLowerCase()
                return hay.includes(s)
            })
    }, [rows, qDebounced, status, patientId, fromDate, toDate, minAmt, maxAmt])

    const sorted = useMemo(() => {
        const arr = [...filtered]
        const created = (x) => {
            const t = x?.created_at ? new Date(x.created_at).getTime() : 0
            return Number.isNaN(t) ? 0 : t
        }
        const net = (x) => Number(x?.net_total || 0)
        const bal = (x) => Number(x?.balance_due || 0)

        switch (sortKey) {
            case 'created_at_asc':
                arr.sort((a, b) => created(a) - created(b))
                break
            case 'created_at_desc':
                arr.sort((a, b) => created(b) - created(a))
                break
            case 'net_asc':
                arr.sort((a, b) => net(a) - net(b))
                break
            case 'net_desc':
                arr.sort((a, b) => net(b) - net(a))
                break
            case 'balance_asc':
                arr.sort((a, b) => bal(a) - bal(b))
                break
            case 'balance_desc':
                arr.sort((a, b) => bal(b) - bal(a))
                break
            default:
                break
        }
        return arr
    }, [filtered, sortKey])

    const totalPages = useMemo(() => Math.max(1, Math.ceil(sorted.length / pageSize)), [sorted.length, pageSize])

    const pageRows = useMemo(() => {
        const p = clamp(page, 1, totalPages)
        const start = (p - 1) * pageSize
        return sorted.slice(start, start + pageSize)
    }, [sorted, page, totalPages, pageSize])

    useEffect(() => {
        setPage((p) => clamp(p, 1, totalPages))
    }, [totalPages])

    const kpis = useMemo(() => {
        const total = sorted.length
        const sumNet = sorted.reduce((a, x) => a + Number(x.net_total || 0), 0)
        const sumPaid = sorted.reduce((a, x) => a + Number(x.amount_paid || 0), 0)
        const sumBal = sorted.reduce((a, x) => a + Number(x.balance_due || 0), 0)
        const drafts = sorted.filter((x) => String(x.status || '').toLowerCase() === 'draft').length
        const finalized = sorted.filter((x) => String(x.status || '').toLowerCase() === 'finalized').length
        return { total, sumNet, sumPaid, sumBal, drafts, finalized }
    }, [sorted])

    const FiltersUI = ({ compact = false }) => (
        <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4">
                    <label className="text-xs font-semibold text-slate-700">Search</label>
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Invoice no / UHID / name / phone…"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                </div>

                <div className="lg:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Status</label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                        <option value="all">All</option>
                        <option value="draft">Draft</option>
                        <option value="finalized">Finalized</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="reversed">Reversed</option>
                    </select>
                </div>

                <div className="lg:col-span-4">
                    <label className="text-xs font-semibold text-slate-700">Patient</label>
                    <div className="mt-1 rounded-2xl border border-slate-200 bg-white p-1">
                        <PatientPicker
                            value={patientId}
                            onChange={(id, obj) => {
                                setPatientId(id)
                                setPatientObj(obj || null)
                            }}
                        />
                    </div>
                    {patientObj ? (
                        <div className="mt-1 text-[11px] text-slate-500">
                            Selected: <span className="font-semibold text-slate-800">{pickName(patientObj)}</span> • UHID{' '}
                            <span className="font-semibold">{pickUhid(patientObj) || '—'}</span>
                        </div>
                    ) : null}
                </div>

                <div className="lg:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Sort</label>
                    <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                        {SORTS.map((s) => (
                            <option key={s.key} value={s.key}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-3">
                    <label className="text-xs font-semibold text-slate-700">From</label>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
                <div className="lg:col-span-3">
                    <label className="text-xs font-semibold text-slate-700">To</label>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
                <div className="lg:col-span-3">
                    <label className="text-xs font-semibold text-slate-700">Min Net</label>
                    <input value={minAmt} onChange={(e) => setMinAmt(e.target.value)} placeholder="0"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
                <div className="lg:col-span-3">
                    <label className="text-xs font-semibold text-slate-700">Max Net</label>
                    <input value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} placeholder="0"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => loadInvoices(false)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Refresh
                    </button>

                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        <span className="text-xs font-semibold text-slate-700">Realtime</span>
                        <button
                            type="button"
                            onClick={() => setRealtime((v) => !v)}
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${realtime
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                                }`}
                        >
                            {realtime ? 'ON' : 'OFF'}
                        </button>

                        <span className="mx-1 h-4 w-px bg-slate-200" />

                        <select
                            value={String(refreshEvery)}
                            onChange={(e) => setRefreshEvery(Number(e.target.value))}
                            disabled={!realtime}
                            className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        >
                            <option value="5">5s</option>
                            <option value="10">10s</option>
                            <option value="15">15s</option>
                            <option value="30">30s</option>
                            <option value="60">60s</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {compact ? (
                <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                    Apply & Close
                </button>
            ) : null}
        </div>
    )

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50">
            <div className="mx-auto max-w-7xl px-3 md:px-6 py-4 md:py-6 space-y-4">

                {/* Header */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Billing Console</h1>
                        <p className="text-xs md:text-sm text-slate-500">
                            Real-time invoices across OP / IP / OT / Lab / Pharmacy / Radiology / General.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => nav('/billing/advance')}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Advances
                        </button>

                        <button
                            type="button"
                            onClick={() => setFiltersOpen(true)}
                            className="md:hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Filters
                        </button>

                        <button
                            type="button"
                            onClick={() => setNewOpen(true)}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            + New Invoice
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {BILLING_TABS.map((tab) => {
                            const active = activeTab === tab.key
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs md:text-sm font-semibold transition-all ${active
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* KPI */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold text-slate-600">Invoices</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">{kpis.total}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-800">
                                Draft {kpis.drafts}
                            </span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
                                Finalized {kpis.finalized}
                            </span>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold text-slate-600">Net Total</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">₹ {money(kpis.sumNet)}</div>
                        <div className="mt-2 text-[11px] text-slate-500">Across current filters</div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold text-slate-600">Paid / Balance</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                            ₹ {money(kpis.sumPaid)} <span className="text-slate-400">/</span> ₹ {money(kpis.sumBal)}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">Paid vs Due</div>
                    </div>
                </div>

                {/* Desktop Filters */}
                <div className="hidden md:block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <FiltersUI />
                </div>

                {/* List header */}
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-3 border-b border-slate-100">
                        <div>
                            <div className="text-sm font-semibold text-slate-900">Invoices</div>
                            <div className="text-[11px] text-slate-500">
                                {loading ? 'Loading…' : `${sorted.length} record(s)`}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={String(pageSize)}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                            >
                                {PAGE_SIZES.map((n) => (
                                    <option key={n} value={String(n)}>
                                        {n} / page
                                    </option>
                                ))}
                            </select>

                            <select
                                value={sortKey}
                                onChange={(e) => setSortKey(e.target.value)}
                                className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                            >
                                {SORTS.map((s) => (
                                    <option key={s.key} value={s.key}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={() => loadInvoices(false)}
                                className="h-9 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Loading / Empty */}
                    {loading ? (
                        <div className="px-4 py-10 text-center text-sm text-slate-500">Loading invoices…</div>
                    ) : sorted.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <div className="text-sm font-semibold text-slate-900">No invoices found</div>
                            <div className="mt-1 text-xs text-slate-500">Try clearing filters or changing tab.</div>
                            <div className="mt-4 flex items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Clear Filters
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewOpen(true)}
                                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                >
                                    New Invoice
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* MOBILE CARD LIST */}
                            <div className="md:hidden p-3 space-y-3">
                                {pageRows.map((inv) => {
                                    const p = inv.patient || null
                                    const st = String(inv.status || 'draft').toLowerCase()
                                    return (
                                        <button
                                            key={inv.id}
                                            type="button"
                                            onClick={() => openInvoice(inv)}
                                            className="w-full text-left rounded-3xl border border-slate-200 bg-white p-3 shadow-sm hover:bg-slate-50"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900">{invNo(inv)}</div>
                                                    <div className="mt-0.5 text-[11px] text-slate-500">{safeDateTime(inv.created_at)}</div>
                                                </div>
                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[st] || STATUS_BADGE.reversed}`}>
                                                    {st.toUpperCase()}
                                                </span>
                                            </div>

                                            <div className="mt-3">
                                                <div className="text-sm font-semibold text-slate-900">{pickName(p)}</div>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
                                                        UHID: {pickUhid(p) || '—'}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                                        {inv.billing_type || 'general'}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                                        📞 {pickPhone(p) || '—'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                                    <div className="text-[11px] text-slate-500">Net</div>
                                                    <div className="font-semibold text-slate-900">₹ {money(inv.net_total)}</div>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                                    <div className="text-[11px] text-slate-500">Paid</div>
                                                    <div className="font-semibold text-slate-900">₹ {money(inv.amount_paid)}</div>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                                    <div className="text-[11px] text-slate-500">Bal</div>
                                                    <div className="font-semibold text-slate-900">₹ {money(inv.balance_due)}</div>
                                                </div>
                                            </div>

                                            <div className="mt-3 text-xs font-bold text-indigo-600">Open →</div>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* DESKTOP TABLE */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr className="border-b border-slate-200">
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Invoice</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Billing</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Patient</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-600">Net</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-600">Paid</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-600">Balance</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Status</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-600"></th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">
                                        {pageRows.map((inv) => {
                                            const p = inv.patient || null
                                            const st = String(inv.status || 'draft').toLowerCase()
                                            return (
                                                <tr
                                                    key={inv.id}
                                                    className="hover:bg-slate-50 cursor-pointer"
                                                    onClick={() => openInvoice(inv)}
                                                >
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="font-semibold text-slate-900">{invNo(inv)}</div>
                                                        <div className="text-[11px] text-slate-500">{safeDateTime(inv.created_at)}</div>
                                                    </td>

                                                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-700">
                                                        {inv.billing_type || 'general'}
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        <div className="min-w-[260px]">
                                                            <div className="font-semibold text-slate-900">{pickName(p)}</div>
                                                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
                                                                    UHID: {pickUhid(p) || '—'}
                                                                </span>
                                                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                                                    📞 {pickPhone(p) || '—'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-slate-900">
                                                        ₹ {money(inv.net_total)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-700">
                                                        ₹ {money(inv.amount_paid)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-slate-900">
                                                        ₹ {money(inv.balance_due)}
                                                    </td>

                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_BADGE[st] || STATUS_BADGE.reversed}`}>
                                                            {st.toUpperCase()}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                                        <span className="text-xs font-bold text-indigo-600">Open →</span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-3 border-t border-slate-100">
                                <div className="text-xs text-slate-500">
                                    Showing <span className="font-bold text-slate-900">{sorted.length === 0 ? 0 : (page - 1) * pageSize + 1}</span>–
                                    <span className="font-bold text-slate-900">{Math.min(page * pageSize, sorted.length)}</span> of{' '}
                                    <span className="font-bold text-slate-900">{sorted.length}</span>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                                        className={`rounded-2xl border px-3 py-2 text-xs font-bold ${page <= 1 ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        Prev
                                    </button>
                                    <span className="text-xs text-slate-600">
                                        Page <span className="font-bold text-slate-900">{page}</span> / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                                        className={`rounded-2xl border px-3 py-2 text-xs font-bold ${page >= totalPages ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

            </div>

            {/* Mobile Filters Drawer */}
            <MobileDrawer
                open={filtersOpen}
                title="Filters & Options"
                onClose={() => setFiltersOpen(false)}
            >
                <FiltersUI compact />
            </MobileDrawer>

            {/* New Invoice Modal */}
            <Modal
                open={newOpen}
                title="Create New Invoice"
                onClose={() => setNewOpen(false)}
                footer={
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setNewOpen(false)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            form="new-invoice-form"
                            type="submit"
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            Create & Open
                        </button>
                    </div>
                }
            >
                <form id="new-invoice-form" className="space-y-4" onSubmit={handleCreateInvoice}>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Patient</label>
                        <div className="rounded-2xl border border-slate-200 bg-white p-1">
                            <PatientPicker
                                value={newForm.patient_id}
                                onChange={(id) => setNewForm((p) => ({ ...p, patient_id: id }))}
                            />
                        </div>
                        <p className="text-[11px] text-slate-500">Search by UHID / Name / Phone and select.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700">Billing Type</label>
                            <select
                                value={newForm.billing_type}
                                onChange={(e) => setNewForm((p) => ({ ...p, billing_type: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            >
                                <option value="op_billing">OP Billing</option>
                                <option value="ip_billing">IP Billing</option>
                                <option value="ot">OT</option>
                                <option value="lab">Lab</option>
                                <option value="pharmacy">Pharmacy</option>
                                <option value="radiology">Radiology</option>
                                <option value="general">General</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700">Context Type (optional)</label>
                            <select
                                value={newForm.context_type}
                                onChange={(e) => setNewForm((p) => ({ ...p, context_type: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            >
                                <option value="">None</option>
                                <option value="opd">OPD</option>
                                <option value="ipd">IPD</option>
                                <option value="ot">OT</option>
                                <option value="lab">Lab</option>
                                <option value="radiology">Radiology</option>
                                <option value="pharmacy">Pharmacy</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700">Context ID (optional)</label>
                            <input
                                type="number"
                                value={newForm.context_id}
                                onChange={(e) => setNewForm((p) => ({ ...p, context_id: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                placeholder="Visit / Admission / Case / Order"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700">Remarks (optional)</label>
                            <input
                                value={newForm.remarks}
                                onChange={(e) => setNewForm((p) => ({ ...p, remarks: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                placeholder="Any note"
                            />
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
