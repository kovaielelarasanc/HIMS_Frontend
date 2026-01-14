// FILE: src/lab/OrderDetail.jsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    getLisOrder,
    finalizeLisReport,
    listLabDepartments,
    getLisPanelServices,
    saveLisPanelResults,
} from '../api/lab'
import { toast } from 'sonner'
import {
    ArrowLeft,
    Check,
    ChevronDown,
    ChevronUp,
    FileText,
    Layers,
    Loader2,
    PlayCircle,
    Save,
    Search,
} from 'lucide-react'
import PermGate from '../components/PermGate'
import PatientBadge from '../components/PatientBadge'

/* -------------------- Date utils (IST safe) -------------------- */
const APP_LOCALE = 'en-IN'
const APP_TZ = 'Asia/Kolkata'
const IST_OFFSET_MIN = 330
const BACKEND_NAIVE_TZ = 'APP' // 'APP'(IST) or 'UTC'

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

const fmtDT = (v) => {
    const d = parseBackendDate(v)
    return d ? DTF.format(d) : '—'
}

/* -------------------- helpers -------------------- */
const formatOrderNo = (id) => {
    if (!id) return '—'
    const s = String(id)
    return `LAB-${s.padStart(6, '0')}`
}

function cx(...a) {
    return a.filter(Boolean).join(' ')
}

/* ✅ “same format” normal range viewer (for Result Entry only) */
function normalizeNormalRange(text) {
    const t = (text ?? '').toString().replace(/\r\n/g, '\n').trim()
    if (!t || t === '-') return { raw: '-', lines: ['—'] }

    if (t.includes('\n')) {
        const lines = t.split('\n').map((x) => x.trim()).filter(Boolean)
        return { raw: t, lines: lines.length ? lines : ['—'] }
    }
    if (t.includes(';')) {
        const lines = t.split(';').map((x) => x.trim()).filter(Boolean)
        return { raw: t, lines: lines.length ? lines : ['—'] }
    }
    return { raw: t, lines: [t] }
}

function NormalRangePreview({ value, expanded, onToggle }) {
    const { lines } = normalizeNormalRange(value)
    const hasMore = lines.length > 3

    return (
        <div className="min-w-0">
            <div
                className={cx(
                    'text-[11px] leading-4 text-slate-700 whitespace-pre-line',
                    expanded ? '' : 'max-h-[3.2rem] overflow-hidden'
                )}
            >
                {lines.slice(0, expanded ? lines.length : 3).join('\n')}
            </div>

            {hasMore && (
                <button
                    type="button"
                    onClick={onToggle}
                    className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                    {expanded ? (
                        <>
                            <ChevronUp className="h-3 w-3" />
                            Less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="h-3 w-3" />
                            More
                        </>
                    )}
                </button>
            )}
        </div>
    )
}

function FlagPill({ flag }) {
    const f = (flag || '').toUpperCase().trim()
    if (!f) return null

    const tone =
        f === 'H'
            ? 'bg-rose-50 text-rose-700 border-rose-100'
            : f === 'L'
                ? 'bg-amber-50 text-amber-800 border-amber-100'
                : 'bg-slate-50 text-slate-700 border-slate-200'

    return (
        <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', tone)}>
            {f}
        </span>
    )
}

/* ✅ Order items (selected tests) */
const getOrderItems = (o) => {
    if (!o) return []
    if (Array.isArray(o.items)) return o.items
    if (Array.isArray(o.order_items)) return o.order_items
    if (Array.isArray(o.orderItems)) return o.orderItems
    return []
}

const itemLabel = (it) => {
    const code = it?.test_code || it?.testCode || it?.code
    const name = it?.test_name || it?.testName || it?.name
    if (code && name) return `${code} — ${name}`
    return name || code || 'Test'
}

const contextLabel = (o) => {
    const t = (o?.context_type || o?.contextType || '').toString().toUpperCase()
    const id = o?.context_id ?? o?.contextId
    if (!t && !id) return null
    if (t && id) return `${t} • #${id}`
    if (t) return t
    if (id) return `#${id}`
    return null
}

export default function OrderDetail() {
    const { id } = useParams()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(false)
    const [order, setOrder] = useState(null)

    // Department masters
    const [allDepartments, setAllDepartments] = useState([])

    // Selected panels (dept + optional sub-dept)
    const [selectedPanels, setSelectedPanels] = useState([])

    // Loaded panel sections
    const [panelSections, setPanelSections] = useState([])
    const [panelLoading, setPanelLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // UI states
    const [expandedRangeKey, setExpandedRangeKey] = useState(null) // `${sectionKey}::${service_id}`
    const [collapsedSections, setCollapsedSections] = useState({}) // sectionKey -> bool

    // ✅ Premium: ordered tests search + collapse
    const [testQ, setTestQ] = useState('')
    const [testsCollapsed, setTestsCollapsed] = useState(false)

    const friendlyOrderNo = useMemo(() => (order ? formatOrderNo(order.id) : '—'), [order])

    const fetchOrder = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await getLisOrder(id)
            setOrder(data)
        } catch (e) {
            console.error(e)
            toast.error('Failed to load order')
        } finally {
            setLoading(false)
        }
    }, [id])

    const fetchDepartments = useCallback(async () => {
        try {
            const { data } = await listLabDepartments({ active_only: true })
            const list = Array.isArray(data) ? data : data?.items || []
            setAllDepartments(list)
        } catch (e) {
            console.error(e)
            toast.error('Failed to load lab departments')
        }
    }, [])

    useEffect(() => {
        fetchOrder()
        fetchDepartments()
    }, [fetchOrder, fetchDepartments])

    // ✅ Order Items (Ordered Tests)
    const orderItems = useMemo(() => getOrderItems(order), [order])

    const filteredItems = useMemo(() => {
        const q = (testQ || '').trim().toLowerCase()
        if (!q) return orderItems

        return orderItems.filter((it) => {
            const hay = [itemLabel(it), it?.test_code || it?.testCode || it?.code, it?.test_name || it?.testName || it?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
            return hay.includes(q)
        })
    }, [orderItems, testQ])

    const canFinalize = useMemo(() => {
        if (!order) return false
        return (order.status || '').toLowerCase() !== 'reported'
    }, [order])

    const onFinalize = async () => {
        try {
            await finalizeLisReport(id)
            toast.success('Report finalized')
            fetchOrder()
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Finalize failed')
        }
    }

    const onOpenPrintView = () => navigate(`/lab/orders/${id}/print`)

    // ---------------- PANEL CHECKLIST HELPERS ----------------

    const departmentTree = useMemo(() => {
        const list = Array.isArray(allDepartments) ? allDepartments : []
        const parents = list.filter((d) => !d.parent_id)
        const childrenByParent = {}
        list.forEach((d) => {
            if (d.parent_id) {
                if (!childrenByParent[d.parent_id]) childrenByParent[d.parent_id] = []
                childrenByParent[d.parent_id].push(d)
            }
        })

        const sortBy = (a, b) => {
            const ao = a.display_order ?? 999999
            const bo = b.display_order ?? 999999
            if (ao !== bo) return ao - bo
            return String(a.name || '').localeCompare(String(b.name || ''))
        }

        return parents
            .slice()
            .sort(sortBy)
            .map((p) => ({
                ...p,
                children: (childrenByParent[p.id] || []).slice().sort(sortBy),
            }))
    }, [allDepartments])

    const isPanelSelected = (deptId, subDeptId = null) => {
        const key = `${deptId}::${subDeptId || 'root'}`
        return selectedPanels.some((p) => p.key === key)
    }

    const togglePanel = (deptId, subDeptId = null, department_name = '', sub_department_name = null) => {
        const key = `${deptId}::${subDeptId || 'root'}`
        setSelectedPanels((prev) => {
            const exists = prev.some((p) => p.key === key)
            if (exists) return prev.filter((p) => p.key !== key)
            return [
                ...prev,
                {
                    key,
                    department_id: deptId,
                    department_name,
                    sub_department_id: subDeptId,
                    sub_department_name,
                },
            ]
        })
    }

    const clearPanels = () => {
        setSelectedPanels([])
        setPanelSections([])
        setExpandedRangeKey(null)
        setCollapsedSections({})
    }

    const loadPanel = async () => {
        if (!selectedPanels.length) {
            toast.error('Select at least one Department / Panel')
            return
        }
        setPanelLoading(true)
        try {
            const results = await Promise.all(
                selectedPanels.map((panel) =>
                    getLisPanelServices(id, {
                        department_id: panel.department_id,
                        sub_department_id: panel.sub_department_id || undefined,
                    }).then((res) => ({
                        panel,
                        rows: Array.isArray(res.data) ? res.data : [],
                    }))
                )
            )

            const sections = results.map(({ panel, rows }) => ({
                key: panel.key,
                department_id: panel.department_id,
                department_name: panel.department_name,
                sub_department_id: panel.sub_department_id,
                sub_department_name: panel.sub_department_name,
                rows: rows.map((r) => ({
                    ...r,
                    result_value: r.result_value ?? '',
                    flag: r.flag ?? '',
                    comments: r.comments ?? '',
                })),
            }))

            setPanelSections(sections)
            const collapsed = {}
            sections.forEach((s) => (collapsed[s.key] = false))
            setCollapsedSections(collapsed)
            toast.success('Panels loaded')
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Failed to load panel services')
        } finally {
            setPanelLoading(false)
        }
    }

    const updatePanelRow = (sectionKey, idx, patch) => {
        setPanelSections((sections) =>
            sections.map((sec) => {
                if (sec.key !== sectionKey) return sec
                return {
                    ...sec,
                    rows: sec.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
                }
            })
        )
    }

    const savePanel = async () => {
        if (!panelSections.length) {
            toast.error('No panel rows loaded')
            return
        }
        setSaving(true)
        try {
            await Promise.all(
                panelSections.map((section) => {
                    if (!section.rows.length) return Promise.resolve()

                    const payload = {
                        department_id: Number(section.department_id),
                        sub_department_id: section.sub_department_id ? Number(section.sub_department_id) : null,
                        results: section.rows.map((r) => ({
                            service_id: r.service_id,
                            result_value: (r.result_value ?? '').toString(),
                            flag: (r.flag || '').toString().trim() || null,
                            comments: (r.comments || '').toString().trim() || null,
                        })),
                    }

                    return saveLisPanelResults(Number(id), payload)
                })
            )

            toast.success('Panel results saved')
            fetchOrder()
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Failed to save panel results')
        } finally {
            setSaving(false)
        }
    }

    const toggleSectionCollapse = (sectionKey) => {
        setCollapsedSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
    }

    if (loading && !order) return <div className="p-6 text-sm text-slate-600">Loading…</div>
    if (!order) return <div className="p-6 text-sm text-slate-600">Order not found</div>

    const status = (order.status || 'ORDERED').toString()
    const priority = (order.priority || 'routine').toString()
    const createdAt = order.created_at || order.createdAt
    const ctx = contextLabel(order)

    return (
        <div className="relative mx-auto w-full max-w-[1400px] p-3 md:p-6 space-y-4">
            {/* subtle premium background */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(15,23,42,0.10),transparent_55%),radial-gradient(900px_circle_at_90%_0%,rgba(2,132,199,0.10),transparent_55%)]" />

            {/* Top header */}
            <div className="rounded-3xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                <div className="p-4 md:p-5 bg-[radial-gradient(60%_120%_at_30%_0%,rgba(15,23,42,0.06),transparent_60%)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    title="Back"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>

                                <div className="min-w-0">
                                    <div className="text-[11px] text-slate-500">Lab Order</div>
                                    <h1 className="text-lg md:text-xl font-semibold text-slate-900 truncate">{friendlyOrderNo}</h1>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <PatientBadge
                                    patient={order?.patient}
                                    patientId={order?.patient_id}
                                    className="border-slate-200 bg-slate-50"
                                />

                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700">
                                    Created: <span className="ml-1 font-semibold">{fmtDT(createdAt)}</span>
                                </span>

                                {ctx ? (
                                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700">
                                        Context: <span className="ml-1 font-semibold">{ctx}</span>
                                    </span>
                                ) : null}

                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700">
                                    Priority: <span className="ml-1 font-semibold capitalize">{priority}</span>
                                </span>

                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700">
                                    Status: <span className="ml-1 font-semibold uppercase">{status}</span>
                                </span>

                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700">
                                    Tests: <span className="ml-1 font-semibold">{orderItems.length}</span>
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={onOpenPrintView}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                <FileText className="h-4 w-4" />
                                View / Print
                            </button>

                            <PermGate anyOf={['lab.results.report', 'lab.results.enter', 'lab.results.approve']}>
                                <button
                                    type="button"
                                    disabled={!canFinalize}
                                    onClick={onFinalize}
                                    className={cx(
                                        'inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-white shadow-sm',
                                        canFinalize ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-400 cursor-not-allowed'
                                    )}
                                >
                                    <Check className="h-4 w-4" />
                                    Finalize
                                </button>
                            </PermGate>
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ PREMIUM: ORDERED TESTS (clean chips, removed status/barcode/result/unit/range) */}
            <section className="rounded-3xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">Ordered Tests</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">Clean list (only test code & name)</div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <div className="relative w-full sm:w-[360px]">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-9 pr-9 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                placeholder="Search test / code / name…"
                                value={testQ}
                                onChange={(e) => setTestQ(e.target.value)}
                            />
                            {testQ ? (
                                <button
                                    type="button"
                                    onClick={() => setTestQ('')}
                                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-xl hover:bg-slate-100"
                                    aria-label="Clear"
                                >
                                    <ChevronDown className="h-4 w-4 rotate-180 text-slate-600" />
                                </button>
                            ) : null}
                        </div>

                        <button
                            type="button"
                            onClick={() => setTestsCollapsed((v) => !v)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            {testsCollapsed ? (
                                <>
                                    <ChevronDown className="h-4 w-4" />
                                    Expand
                                </>
                            ) : (
                                <>
                                    <ChevronUp className="h-4 w-4" />
                                    Collapse
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {!testsCollapsed && (
                    <div className="p-4">
                        {filteredItems.length === 0 ? (
                            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                                No tests match your search.
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="text-[11px] text-slate-500">
                                        Showing <span className="font-semibold text-slate-700">{filteredItems.length}</span> of{' '}
                                        <span className="font-semibold text-slate-700">{orderItems.length}</span>
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-3">
                                    <div className="flex flex-wrap gap-2">
                                        {filteredItems.map((it, idx) => {
                                            const key = String(it?.id || it?.test_id || it?.testId || it?.test_code || `${idx}`)
                                            return (
                                                <span
                                                    key={key}
                                                    title={itemLabel(it)}
                                                    className={cx(
                                                        'inline-flex max-w-full items-center rounded-full',
                                                        'border border-slate-200 bg-white',
                                                        'px-3 py-1 text-[11px] font-semibold text-slate-700',
                                                        'shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:bg-slate-50'
                                                    )}
                                                >
                                                    <span className="max-w-[520px] truncate">{itemLabel(it)}</span>
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </section>

            {/* MAIN WORKFLOW */}
            <section className="rounded-3xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                {/* Section header */}
                <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                            <Layers className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">Result Entry</h2>
                            <p className="text-[11px] text-slate-500">
                                Select panels, enter values, save, then finalize.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={loadPanel}
                            disabled={panelLoading || !selectedPanels.length}
                            className={cx(
                                'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold',
                                panelLoading || !selectedPanels.length
                                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            )}
                        >
                            {panelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                            Start Entry
                        </button>

                        <PermGate anyOf={['lab.results.enter']}>
                            <button
                                type="button"
                                onClick={savePanel}
                                disabled={saving || !panelSections.length}
                                className={cx(
                                    'inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-white shadow-sm',
                                    saving || !panelSections.length ? 'bg-emerald-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                                )}
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Results
                            </button>
                        </PermGate>

                        <button
                            type="button"
                            onClick={clearPanels}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* Checklist */}
                <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold text-slate-800">Select Departments & Panels</h3>
                        <p className="text-[11px] text-slate-500">Tick one or more Departments / Sub-Departments.</p>
                    </div>

                    <div className="mt-3 max-h-64 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3">
                        {departmentTree.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">No lab departments configured.</div>
                        ) : (
                            <div className="space-y-2">
                                {departmentTree.map((dept) => (
                                    <div key={dept.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                                                checked={isPanelSelected(dept.id, null)}
                                                onChange={() => togglePanel(dept.id, null, dept.name, null)}
                                            />
                                            <span className="min-w-0 truncate">{dept.name}</span>
                                            <span className="ml-auto text-[11px] font-medium text-slate-500">(All tests)</span>
                                        </label>

                                        {!!dept.children.length && (
                                            <div className="mt-2 grid gap-1 pl-6">
                                                {dept.children.map((sub) => (
                                                    <label key={sub.id} className="flex items-center gap-2 text-xs text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                                                            checked={isPanelSelected(dept.id, sub.id)}
                                                            onChange={() => togglePanel(dept.id, sub.id, dept.name, sub.name)}
                                                        />
                                                        <span className="min-w-0 truncate">{sub.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-2 text-[11px] text-slate-600">
                        Selected panels: <span className="font-semibold">{selectedPanels.length || 0}</span>
                    </div>
                </div>

                {/* Panels */}
                {panelLoading && (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Loading selected panels…
                    </div>
                )}

                {!panelLoading && panelSections.length === 0 && (
                    <div className="px-4 py-10 text-center text-xs text-slate-400">
                        Select panels above and click <span className="font-semibold text-slate-600">Start Entry</span> to load tests.
                    </div>
                )}

                {!panelLoading &&
                    panelSections.map((section) => {
                        const title = `${section.department_name}${section.sub_department_name ? ` / ${section.sub_department_name}` : ''}`
                        const isCollapsed = !!collapsedSections[section.key]

                        return (
                            <div key={section.key} className="border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => toggleSectionCollapse(section.key)}
                                    className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100/70"
                                >
                                    <div className="min-w-0">
                                        <div className="text-xs font-semibold text-slate-800 truncate">{title}</div>
                                        <div className="text-[11px] text-slate-500">{section.rows?.length || 0} test(s)</div>
                                    </div>
                                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
                                        {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                    </div>
                                </button>

                                {!isCollapsed && (
                                    <>
                                        {/* Mobile cards */}
                                        <div className="md:hidden p-4 space-y-2">
                                            {section.rows.length === 0 && <div className="text-xs text-slate-400">No services configured for this panel.</div>}

                                            {section.rows.map((row, idx) => {
                                                const expKey = `${section.key}::${row.service_id}`
                                                const expanded = expandedRangeKey === expKey

                                                return (
                                                    <div key={row.service_id} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-semibold text-slate-900 truncate">{row.service_name}</div>
                                                                <div className="mt-1 text-[11px] text-slate-500">
                                                                    Unit: <span className="font-semibold text-slate-700">{row.unit || '—'}</span>
                                                                </div>
                                                            </div>
                                                            <FlagPill flag={row.flag} />
                                                        </div>

                                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                                            <div>
                                                                <div className="text-[10px] font-semibold text-slate-500 uppercase">Result</div>
                                                                <input
                                                                    className="mt-1 h-9 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                    value={row.result_value}
                                                                    onChange={(e) => updatePanelRow(section.key, idx, { result_value: e.target.value })}
                                                                />
                                                            </div>

                                                            <div>
                                                                <div className="text-[10px] font-semibold text-slate-500 uppercase">Flag</div>
                                                                <input
                                                                    className="mt-1 h-9 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                    placeholder="H / L / N"
                                                                    value={row.flag || ''}
                                                                    onChange={(e) =>
                                                                        updatePanelRow(section.key, idx, {
                                                                            flag: (e.target.value || '').toUpperCase().slice(0, 2),
                                                                        })
                                                                    }
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="mt-3">
                                                            <div className="text-[10px] font-semibold text-slate-500 uppercase">Normal Range</div>
                                                            <div className="mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                                                <NormalRangePreview
                                                                    value={row.normal_range}
                                                                    expanded={expanded}
                                                                    onToggle={() => setExpandedRangeKey(expanded ? null : expKey)}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="mt-3">
                                                            <div className="text-[10px] font-semibold text-slate-500 uppercase">Comments</div>
                                                            <input
                                                                className="mt-1 h-9 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                placeholder="Optional"
                                                                value={row.comments || ''}
                                                                onChange={(e) => updatePanelRow(section.key, idx, { comments: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Desktop table */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="min-w-full border-separate border-spacing-0">
                                                <thead className="sticky top-0 z-10 bg-white">
                                                    <tr className="text-[11px] text-slate-500">
                                                        <th className="border-b border-slate-100 px-4 py-3 text-left font-semibold">Service</th>
                                                        <th className="border-b border-slate-100 px-4 py-3 text-left font-semibold w-[180px]">Result</th>
                                                        <th className="border-b border-slate-100 px-4 py-3 text-left font-semibold w-[110px]">Unit</th>
                                                        <th className="border-b border-slate-100 px-4 py-3 text-left font-semibold">Normal Range</th>
                                                        <th className="border-b border-slate-100 px-4 py-3 text-left font-semibold w-[140px]">Flag</th>
                                                        <th className="border-b border-slate-100 px-4 py-3 text-left font-semibold w-[220px]">Comments</th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {section.rows.map((row, idx) => {
                                                        const expKey = `${section.key}::${row.service_id}`
                                                        const expanded = expandedRangeKey === expKey

                                                        return (
                                                            <tr key={row.service_id} className="border-b border-slate-100 hover:bg-slate-50/60">
                                                                <td className="px-4 py-3 align-top">
                                                                    <div className="text-sm font-semibold text-slate-900">{row.service_name}</div>
                                                                </td>

                                                                <td className="px-4 py-3 align-top">
                                                                    <input
                                                                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                        value={row.result_value}
                                                                        onChange={(e) => updatePanelRow(section.key, idx, { result_value: e.target.value })}
                                                                    />
                                                                </td>

                                                                <td className="px-4 py-3 align-top">
                                                                    <div className="text-sm text-slate-700">{row.unit || '—'}</div>
                                                                </td>

                                                                <td className="px-4 py-3 align-top">
                                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                                                        <NormalRangePreview
                                                                            value={row.normal_range}
                                                                            expanded={expanded}
                                                                            onToggle={() => setExpandedRangeKey(expanded ? null : expKey)}
                                                                        />
                                                                    </div>
                                                                </td>

                                                                <td className="px-4 py-3 align-top">
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                            placeholder="H / L / N"
                                                                            value={row.flag || ''}
                                                                            onChange={(e) =>
                                                                                updatePanelRow(section.key, idx, {
                                                                                    flag: (e.target.value || '').toUpperCase().slice(0, 2),
                                                                                })
                                                                            }
                                                                        />
                                                                        <FlagPill flag={row.flag} />
                                                                    </div>
                                                                </td>

                                                                <td className="px-4 py-3 align-top">
                                                                    <input
                                                                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                                                        placeholder="Optional"
                                                                        value={row.comments || ''}
                                                                        onChange={(e) => updatePanelRow(section.key, idx, { comments: e.target.value })}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}

                                                    {section.rows.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                                                                No services configured for this panel.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    })}
            </section>
        </div>
    )
}
