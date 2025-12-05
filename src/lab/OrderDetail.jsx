// FILE: src/lab/OrderDetail.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    getLisOrder,
    finalizeLisReport,
    listLabDepartments,
    getLisPanelServices,
    saveLisPanelResults,
} from '../api/lab'
import { toast } from 'sonner'
import { Check, Layers, PlayCircle, FileText } from 'lucide-react'
import PermGate from '../components/PermGate'
import PatientBadge from '../components/PatientBadge'

const fmtDT = (v) => (v ? new Date(v).toLocaleString() : '—')

const formatOrderNo = (id) => {
    if (!id) return '—'
    const s = String(id)
    return `LAB-${s.padStart(6, '0')}`
}

export default function OrderDetail() {
    const { id } = useParams()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(false)
    const [order, setOrder] = useState(null)

    // Department / Sub-department masters
    const [allDepartments, setAllDepartments] = useState([])

    // Selected panels (dept + optional sub-dept)
    const [selectedPanels, setSelectedPanels] = useState([])

    // Loaded panel sections
    const [panelSections, setPanelSections] = useState([])
    const [panelLoading, setPanelLoading] = useState(false)

    const friendlyOrderNo = useMemo(
        () => (order ? formatOrderNo(order.id) : '—'),
        [order],
    )

    const fetchOrder = async () => {
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
    }

    const fetchDepartments = async () => {
        try {
            const { data } = await listLabDepartments({ active_only: true })
            const list = Array.isArray(data) ? data : data?.items || []
            setAllDepartments(list)
        } catch (e) {
            console.error(e)
            toast.error('Failed to load lab departments')
        }
    }

    useEffect(() => {
        fetchOrder()
        fetchDepartments()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    // Build department → children tree for checklist
    const departmentTree = useMemo(() => {
        const parents = allDepartments.filter((d) => !d.parent_id)
        const childrenByParent = {}
        allDepartments.forEach((d) => {
            if (d.parent_id) {
                if (!childrenByParent[d.parent_id]) {
                    childrenByParent[d.parent_id] = []
                }
                childrenByParent[d.parent_id].push(d)
            }
        })
        return parents.map((p) => ({
            ...p,
            children: childrenByParent[p.id] || [],
        }))
    }, [allDepartments])

    // Finalize enable/disable
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

    const onOpenPrintView = () => {
        navigate(`/lab/orders/${id}/print`)
    }

    // ---------------- PANEL CHECKLIST HELPERS ----------------

    const isPanelSelected = (deptId, subDeptId = null) => {
        const key = `${deptId}::${subDeptId || 'root'}`
        return selectedPanels.some((p) => p.key === key)
    }

    const togglePanel = (
        deptId,
        subDeptId = null,
        department_name = '',
        sub_department_name = null,
    ) => {
        const key = `${deptId}::${subDeptId || 'root'}`
        setSelectedPanels((prev) => {
            const exists = prev.some((p) => p.key === key)
            if (exists) {
                return prev.filter((p) => p.key !== key)
            }
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

    const loadPanel = async () => {
        if (!selectedPanels.length) {
            toast.error('Select at least one Department / Panel')
            return
        }
        setPanelLoading(true)
        try {
            const promises = selectedPanels.map((panel) =>
                getLisPanelServices(id, {
                    department_id: panel.department_id,
                    sub_department_id: panel.sub_department_id || undefined,
                }).then((res) => ({
                    panel,
                    rows: Array.isArray(res.data) ? res.data : [],
                })),
            )

            const results = await Promise.all(promises)

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
        } catch (e) {
            console.error(e)
            toast.error(
                e?.response?.data?.detail || 'Failed to load panel services',
            )
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
                    rows: sec.rows.map((r, i) =>
                        i === idx ? { ...r, ...patch } : r,
                    ),
                }
            }),
        )
    }

    const savePanel = async () => {
        if (!panelSections.length) {
            toast.error('No panel rows loaded')
            return
        }
        try {
            for (const section of panelSections) {
                if (!section.rows.length) continue

                const payload = {
                    department_id: Number(section.department_id),
                    sub_department_id: section.sub_department_id
                        ? Number(section.sub_department_id)
                        : null,
                    results: section.rows.map((r) => ({
                        service_id: r.service_id,
                        result_value: r.result_value ?? '',
                        flag: r.flag || null,
                        comments: r.comments || null,
                    })),
                }

                await saveLisPanelResults(Number(id), payload)
            }

            toast.success('Panel results saved')
            fetchOrder()
        } catch (e) {
            console.error(e)
            toast.error(
                e?.response?.data?.detail || 'Failed to save panel results',
            )
        }
    }

    // ----------------------------------------------------------------------

    if (loading && !order) return <div className="p-6">Loading…</div>
    if (!order) return <div className="p-6">Order not found</div>

    return (
        <div className="p-3 md:p-6 space-y-6 text-black">
            {/* HEADER */}
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <h1 className="text-lg md:text-xl font-semibold">
                        Lab Order {friendlyOrderNo}
                    </h1>

                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                        <PatientBadge
                            patient={order?.patient}
                            patientId={order?.patient_id}
                            className="border-blue-100 bg-blue-50"
                        />
                        <span>· Created: {fmtDT(order.created_at || order.createdAt)}</span>
                    </div>

                    <div className="text-xs text-gray-500">
                        Priority:{' '}
                        <span className="capitalize font-medium">
                            {order.priority || 'routine'}
                        </span>{' '}
                        · Status:{' '}
                        <span className="uppercase font-semibold">
                            {order.status || 'ORDERED'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        className="btn-ghost flex items-center gap-1 text-xs md:text-sm"
                        onClick={onOpenPrintView}
                    >
                        <FileText className="h-4 w-4" />
                        View / Print Report
                    </button>

                    <PermGate
                        anyOf={[
                            'lab.results.report',
                            'lab.results.enter',
                            'lab.results.approve',
                        ]}
                    >
                        <button
                            className="btn"
                            disabled={!canFinalize}
                            onClick={onFinalize}
                        >
                            <Check className="h-4 w-4 mr-2" /> Finalize
                        </button>
                    </PermGate>
                </div>
            </header>

            {/* MAIN WORKFLOW: PANEL-BASED RESULT ENTRY */}
            <section className="rounded-xl border bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
                    <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-gray-500" />
                        <div>
                            <h2 className="font-semibold text-sm md:text-base">
                                Result Entry (Multi Department / Panel)
                            </h2>
                            <p className="text-[11px] text-gray-500">
                                Select department/panel, enter all values, save, then finalize.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <button
                            className="btn-ghost flex items-center gap-1"
                            onClick={loadPanel}
                        >
                            <PlayCircle className="h-4 w-4" />
                            Start Entry
                        </button>
                        <PermGate anyOf={['lab.results.enter']}>
                            <button
                                className="btn"
                                onClick={savePanel}
                                disabled={!panelSections.length}
                            >
                                Save Panel Results
                            </button>
                        </PermGate>
                    </div>
                </div>

                {/* CHECKLIST AREA */}
                <div className="p-4 border-b bg-slate-50">
                    <h3 className="text-sm font-medium mb-1">
                        Select Departments & Panels
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Tick one or more Departments / Sub-Departments. All selected tests
                        will appear below, grouped heading-wise.
                    </p>

                    <div className="max-h-64 overflow-y-auto rounded-lg border bg-white p-3 space-y-2">
                        {departmentTree.length === 0 && (
                            <div className="text-xs text-gray-400">
                                No lab departments configured.
                            </div>
                        )}

                        {departmentTree.map((dept) => (
                            <div
                                key={dept.id}
                                className="border rounded-lg p-2 bg-slate-50/60"
                            >
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={isPanelSelected(dept.id, null)}
                                        onChange={() =>
                                            togglePanel(dept.id, null, dept.name, null)
                                        }
                                    />
                                    <span>{dept.name}</span>
                                    <span className="text-[11px] text-gray-400">
                                        (All tests in this department)
                                    </span>
                                </label>

                                {!!dept.children.length && (
                                    <div className="mt-2 pl-4 space-y-1">
                                        {dept.children.map((sub) => (
                                            <label
                                                key={sub.id}
                                                className="flex items-center gap-2 text-xs text-slate-700"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isPanelSelected(dept.id, sub.id)}
                                                    onChange={() =>
                                                        togglePanel(
                                                            dept.id,
                                                            sub.id,
                                                            dept.name,
                                                            sub.name,
                                                        )
                                                    }
                                                />
                                                <span>{sub.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-2 text-[11px] text-gray-500">
                        Selected panels:{' '}
                        <span className="font-semibold">
                            {selectedPanels.length || 0}
                        </span>
                    </div>
                </div>

                {/* PANEL ENTRY TABLES, GROUPED BY DEPARTMENT / SUB-DEPARTMENT */}
                {panelLoading && (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                        Loading selected panels…
                    </div>
                )}

                {!panelLoading && panelSections.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">
                        Select one or more Departments / Panels above and click{' '}
                        <span className="font-medium">Start Entry</span> to load tests.
                    </div>
                )}

                {!panelLoading &&
                    panelSections.map((section) => (
                        <div key={section.key} className="border-t">
                            <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                                {section.department_name}
                                {section.sub_department_name
                                    ? ` / ${section.sub_department_name}`
                                    : ''}
                            </div>

                            {/* Mobile: cards */}
                            <div className="md:hidden p-3 space-y-2">
                                {section.rows.length === 0 && (
                                    <div className="text-xs text-gray-400">
                                        No services configured for this panel.
                                    </div>
                                )}
                                {section.rows.map((row, idx) => (
                                    <div
                                        key={row.service_id}
                                        className="border rounded-lg p-2 space-y-1 bg-white"
                                    >
                                        <div className="text-xs font-semibold">
                                            {row.service_name}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                                            <div className="space-y-1">
                                                <div>
                                                    <div className="text-[10px] uppercase text-gray-400">
                                                        Result
                                                    </div>
                                                    <input
                                                        className="input h-7 text-xs"
                                                        value={row.result_value}
                                                        onChange={(e) =>
                                                            updatePanelRow(section.key, idx, {
                                                                result_value: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase text-gray-400">
                                                        Flag
                                                    </div>
                                                    <input
                                                        className="input h-7 text-xs"
                                                        placeholder="H/L/N"
                                                        value={row.flag || ''}
                                                        onChange={(e) =>
                                                            updatePanelRow(section.key, idx, {
                                                                flag: e.target.value.toUpperCase(),
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div>
                                                    <div className="text-[10px] uppercase text-gray-400">
                                                        Unit
                                                    </div>
                                                    <div className="text-[11px]">
                                                        {row.unit || '—'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase text-gray-400">
                                                        Normal Range
                                                    </div>
                                                    <div className="text-[11px]">
                                                        {row.normal_range || '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-1">
                                            <div className="text-[10px] uppercase text-gray-400">
                                                Comments
                                            </div>
                                            <input
                                                className="input h-7 text-xs"
                                                placeholder="Comments"
                                                value={row.comments || ''}
                                                onChange={(e) =>
                                                    updatePanelRow(section.key, idx, {
                                                        comments: e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop: table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Service</th>
                                            <th className="px-3 py-2 text-left">Result</th>
                                            <th className="px-3 py-2 text-left">Unit</th>
                                            <th className="px-3 py-2 text-left">
                                                Normal Range
                                            </th>
                                            <th className="px-3 py-2 text-left">Flag</th>
                                            <th className="px-3 py-2 text-left">Comments</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {section.rows.map((row, idx) => (
                                            <tr
                                                key={row.service_id}
                                                className="border-t hover:bg-slate-50/80"
                                            >
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">
                                                        {row.service_name}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        className="input"
                                                        value={row.result_value}
                                                        onChange={(e) =>
                                                            updatePanelRow(section.key, idx, {
                                                                result_value: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-600">
                                                    {row.unit || '—'}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-600">
                                                    {row.normal_range || '—'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        className="input"
                                                        placeholder="Flag (H/L/N)"
                                                        value={row.flag || ''}
                                                        onChange={(e) =>
                                                            updatePanelRow(section.key, idx, {
                                                                flag: e.target.value.toUpperCase(),
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        className="input"
                                                        placeholder="Comments"
                                                        value={row.comments || ''}
                                                        onChange={(e) =>
                                                            updatePanelRow(section.key, idx, {
                                                                comments: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        {section.rows.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="px-3 py-4 text-center text-xs text-gray-400"
                                                >
                                                    No services configured for this panel.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
            </section>
        </div>
    )
}
