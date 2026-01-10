// FILE: src/pages/masters/ChargeMaster.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
    createChargeItem,
    deleteChargeItem,
    isCanceledError,
    listChargeItems,
    updateChargeItem,
} from "@/api/chargeMaster"
import {
    Plus,
    Search,
    RefreshCcw,
    Pencil,
    Trash2,
    ToggleLeft,
    ToggleRight,
    X,
    SlidersHorizontal,
} from "lucide-react"

const CATEGORIES = [
    { value: "ADM", label: "Admission" },
    { value: "DIET", label: "Dietary" },
    { value: "MISC", label: "Misc" },
    { value: "BLOOD", label: "Blood Bank" },
]

// Align with backend validator / billing enums
const MODULE_HEADERS = [
    { value: "OPD", label: "OPD" },
    { value: "IPD", label: "IPD" },
    { value: "OT", label: "OT" },
    { value: "ER", label: "ER" },
    { value: "LAB", label: "LAB" },
    { value: "RIS", label: "RIS" },
    { value: "PHARM", label: "PHARM" },
    { value: "ROOM", label: "ROOM" },
    { value: "MISC", label: "MISC" },
]

// Align with Billing.ServiceGroup allowed list
const SERVICE_HEADERS = [
    { value: "CONSULT", label: "CONSULT" },
    { value: "LAB", label: "LAB" },
    { value: "RAD", label: "RAD" },
    { value: "PHARM", label: "PHARM" },
    { value: "OT", label: "OT" },
    { value: "PROC", label: "PROC" },
    { value: "ROOM", label: "ROOM" },
    { value: "NURSING", label: "NURSING" },
    { value: "MISC", label: "MISC" },
]

const cx = (...a) => a.filter(Boolean).join(" ")

function toNumStr(v) {
    const s = String(v ?? "")
    return s === "" ? "" : s
}

function normalizeCode(code) {
    return String(code || "").trim().toUpperCase()
}

function normalizeHdr(v) {
    const s = String(v ?? "").trim().toUpperCase()
    return s === "" ? "" : s
}

function validate(form) {
    const errors = {}

    const category = String(form.category || "").trim().toUpperCase()
    if (!category) errors.category = "Category is required"

    const code = normalizeCode(form.code)
    if (!code) errors.code = "Code is required"
    if (code.length > 40) errors.code = "Max 40 chars"
    if (code && !/^[A-Z0-9\-_\/]+$/.test(code)) errors.code = "Allowed: A-Z 0-9 - _ /"

    const name = String(form.name || "").trim()
    if (!name) errors.name = "Name is required"
    if (name.length > 255) errors.name = "Max 255 chars"

    const price = Number(form.price ?? 0)
    if (Number.isNaN(price)) errors.price = "Invalid price"
    if (price < 0) errors.price = "Price cannot be negative"

    const gst = Number(form.gst_rate ?? 0)
    if (Number.isNaN(gst)) errors.gst_rate = "Invalid GST"
    if (gst < 0 || gst > 100) errors.gst_rate = "GST must be 0 to 100"

    // NEW: MISC requires module_header + service_header (backend rule)
    if (category === "MISC") {
        const mh = normalizeHdr(form.module_header)
        const sh = normalizeHdr(form.service_header)
        if (!mh) errors.module_header = "Module header is required for MISC"
        if (!sh) errors.service_header = "Service header is required for MISC"
    }

    return errors
}

function Modal({ open, title, children, onClose }) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <div className="text-lg font-semibold text-slate-900">{title}</div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 transition"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    )
}

function Badge({ children, tone = "slate" }) {
    const map = {
        slate: "bg-slate-100 text-slate-700",
        green: "bg-emerald-100 text-emerald-700",
        red: "bg-rose-100 text-rose-700",
        blue: "bg-sky-100 text-sky-700",
        amber: "bg-amber-100 text-amber-800",
    }
    return (
        <span
            className={cx(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                map[tone] || map.slate
            )}
        >
            {children}
        </span>
    )
}

function PillButton({ active, children, onClick }) {
    return (
        <button
            onClick={onClick}
            className={cx(
                "h-10 px-3 rounded-xl border text-sm font-semibold transition",
                active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
        >
            {children}
        </button>
    )
}

export default function ChargeMaster() {
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [total, setTotal] = useState(0)

    const [category, setCategory] = useState("ADM")
    const [activeFilter, setActiveFilter] = useState("ACTIVE") // ACTIVE | INACTIVE | ALL
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    // NEW: Advanced filter panel + filters for MISC headers
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [moduleHeaderFilter, setModuleHeaderFilter] = useState("") // string or ""
    const [serviceHeaderFilter, setServiceHeaderFilter] = useState("") // string or ""

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null) // row or null
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        category: "ADM",
        code: "",
        name: "",
        module_header: "",
        service_header: "",
        price: "0",
        gst_rate: "0",
        is_active: true,
    })
    const [errors, setErrors] = useState({})

    const abortRef = useRef(null)

    const isActiveParam = useMemo(() => {
        if (activeFilter === "ALL") return undefined
        return activeFilter === "ACTIVE"
    }, [activeFilter])

    const pageCount = useMemo(
        () => Math.max(1, Math.ceil(total / pageSize)),
        [total, pageSize]
    )

    const isMisc = useMemo(() => String(category).toUpperCase() === "MISC", [category])

    async function load() {
        if (abortRef.current) abortRef.current.abort()
        const ac = new AbortController()
        abortRef.current = ac

        setLoading(true)
        try {
            const data = await listChargeItems({
                category,
                is_active: isActiveParam,
                search,
                page,
                page_size: pageSize,
                sort: "updated_at",
                order: "desc",
                // NEW: send filters only if present (backend supports)
                module_header: moduleHeaderFilter || undefined,
                service_header: serviceHeaderFilter || undefined,
            })
            if (ac.signal.aborted) return
            setRows(data.items || [])
            setTotal(Number(data.total || 0))
        } catch (e) {
            if (isCanceledError(e)) return
            toast.error(e?.response?.data?.detail || e?.message || "Failed to load")
        } finally {
            if (!ac.signal.aborted) setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        category,
        activeFilter,
        page,
        pageSize,
        moduleHeaderFilter,
        serviceHeaderFilter,
    ])

    // search debounce
    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1)
            load()
        }, 350)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    // If category is not MISC, auto-clear MISC-specific list filters
    useEffect(() => {
        if (String(category).toUpperCase() !== "MISC") {
            if (moduleHeaderFilter) setModuleHeaderFilter("")
            if (serviceHeaderFilter) setServiceHeaderFilter("")
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category])

    function openCreate() {
        setEditing(null)
        setErrors({})
        setForm({
            category,
            code: "",
            name: "",
            module_header: "",
            service_header: "",
            price: "0",
            gst_rate: "0",
            is_active: true,
        })
        setModalOpen(true)
    }

    function openEdit(row) {
        setEditing(row)
        setErrors({})
        setForm({
            category: row.category,
            code: row.code,
            name: row.name,
            module_header: row.module_header || "",
            service_header: row.service_header || "",
            price: toNumStr(row.price),
            gst_rate: toNumStr(row.gst_rate),
            is_active: !!row.is_active,
        })
        setModalOpen(true)
    }

    function closeModal() {
        if (saving) return
        setModalOpen(false)
    }

    async function onSave() {
        const payload = {
            category: String(form.category || "").trim().toUpperCase(),
            code: normalizeCode(form.code),
            name: String(form.name || "").trim(),
            price: form.price === "" ? 0 : Number(form.price),
            gst_rate: form.gst_rate === "" ? 0 : Number(form.gst_rate),
            is_active: !!form.is_active,
        }

        // NEW: attach misc headers
        if (payload.category === "MISC") {
            payload.module_header = normalizeHdr(form.module_header) || null
            payload.service_header = normalizeHdr(form.service_header) || null
        } else {
            // backend will force null anyway, but keep clean
            payload.module_header = null
            payload.service_header = null
        }

        const v = validate({ ...payload })
        setErrors(v)
        if (Object.keys(v).length) return

        setSaving(true)
        try {
            if (editing?.id) {
                await updateChargeItem(editing.id, payload)
                toast.success("Charge item updated")
            } else {
                await createChargeItem(payload)
                toast.success("Charge item created")
            }
            setModalOpen(false)
            setPage(1)
            load()
        } catch (e) {
            const msg = e?.response?.data?.detail || e?.message || "Save failed"
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function onToggleActive(row) {
        try {
            await updateChargeItem(row.id, { is_active: !row.is_active })
            toast.success(row.is_active ? "Deactivated" : "Activated")
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || e?.message || "Failed")
        }
    }

    async function onDelete(row) {
        const ok = window.confirm(
            `Delete "${row.name}"?\n\nOK = Soft delete (inactive).\nCancel = abort.`
        )
        if (!ok) return
        try {
            await deleteChargeItem(row.id, { hard: false })
            toast.success("Deleted (inactive)")
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || e?.message || "Failed")
        }
    }

    function clearAllFilters() {
        setSearch("")
        setActiveFilter("ACTIVE")
        setModuleHeaderFilter("")
        setServiceHeaderFilter("")
        setPage(1)
    }

    return (
        <div className="p-4 md:p-6">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Header */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 md:p-5 border-b border-slate-200">
                    <div>
                        <div className="text-xl font-semibold text-slate-900">
                            Charge Master
                        </div>
                        <div className="text-sm text-slate-500">
                            ADM / DIET / MISC / BLOOD master items
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAdvanced((s) => !s)}
                            className={cx(
                                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
                                showAdvanced
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            )}
                            title="Filters"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            Filters
                        </button>

                        <button
                            onClick={load}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            <RefreshCcw className={cx("h-4 w-4", loading && "animate-spin")} />
                            Refresh
                        </button>

                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            <Plus className="h-4 w-4" />
                            New Item
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 md:p-5 flex flex-col gap-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <select
                                value={category}
                                onChange={(e) => {
                                    setCategory(e.target.value)
                                    setPage(1)
                                }}
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                        {c.value} — {c.label}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={activeFilter}
                                onChange={(e) => {
                                    setActiveFilter(e.target.value)
                                    setPage(1)
                                }}
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                                <option value="ALL">All</option>
                            </select>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by code / name / headers…"
                                    className="h-10 w-full md:w-96 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500">Rows:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value))
                                    setPage(1)
                                }}
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            >
                                {[10, 20, 30, 50, 100].map((n) => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    {showAdvanced && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 md:p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-800">
                                    Advanced Filters
                                </div>
                                <button
                                    onClick={clearAllFilters}
                                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
                                >
                                    Clear
                                </button>
                            </div>

                            {/* Show these only for MISC (since backend meaning is for MISC) */}
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className={cx(!isMisc && "opacity-60")}>
                                    <label className="text-xs font-semibold text-slate-600">
                                        Module Header (MISC)
                                    </label>
                                    <select
                                        value={moduleHeaderFilter}
                                        onChange={(e) => {
                                            setModuleHeaderFilter(e.target.value)
                                            setPage(1)
                                        }}
                                        disabled={!isMisc}
                                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100"
                                    >
                                        <option value="">All</option>
                                        {MODULE_HEADERS.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.value}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-1 text-[11px] text-slate-500">
                                        Links to BillingInvoice.module filtering
                                    </div>
                                </div>

                                <div className={cx(!isMisc && "opacity-60")}>
                                    <label className="text-xs font-semibold text-slate-600">
                                        Service Header (MISC)
                                    </label>
                                    <select
                                        value={serviceHeaderFilter}
                                        onChange={(e) => {
                                            setServiceHeaderFilter(e.target.value)
                                            setPage(1)
                                        }}
                                        disabled={!isMisc}
                                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100"
                                    >
                                        <option value="">All</option>
                                        {SERVICE_HEADERS.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.value}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-1 text-[11px] text-slate-500">
                                        Links to BillingInvoiceLine.service_group
                                    </div>
                                </div>

                                <div className="flex items-end">
                                    <div className="w-full rounded-xl border border-slate-200 bg-white p-3">
                                        <div className="text-xs font-semibold text-slate-700">
                                            Tip
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            Select <span className="font-semibold">MISC</span> to enable billing header filters.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="px-4 md:px-5 pb-5">
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr className="text-left text-slate-600">
                                    <th className="px-4 py-3">Code</th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Headers</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3">GST %</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 w-[240px]">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td className="px-4 py-6 text-slate-500" colSpan={7}>
                                            Loading…
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td className="px-4 py-6 text-slate-500" colSpan={7}>
                                            No items found.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r) => (
                                        <tr key={r.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-3 font-semibold text-slate-900">
                                                {r.code}
                                            </td>
                                            <td className="px-4 py-3 text-slate-800">{r.name}</td>

                                            <td className="px-4 py-3">
                                                {String(r.category).toUpperCase() === "MISC" ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge tone="blue">
                                                            {r.module_header || "—"}
                                                        </Badge>
                                                        <Badge tone="amber">
                                                            {r.service_header || "—"}
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">
                                                        —
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3 text-slate-800">
                                                ₹ {Number(r.price || 0).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-800">
                                                {Number(r.gst_rate || 0).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {r.is_active ? (
                                                    <Badge tone="green">Active</Badge>
                                                ) : (
                                                    <Badge tone="red">Inactive</Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => openEdit(r)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        Edit
                                                    </button>

                                                    <button
                                                        onClick={() => onToggleActive(r)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        {r.is_active ? (
                                                            <ToggleLeft className="h-4 w-4" />
                                                        ) : (
                                                            <ToggleRight className="h-4 w-4" />
                                                        )}
                                                        {r.is_active ? "Disable" : "Enable"}
                                                    </button>

                                                    <button
                                                        onClick={() => onDelete(r)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                            Total:{" "}
                            <span className="font-semibold text-slate-800">{total}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                            >
                                Prev
                            </button>

                            <div className="text-sm text-slate-600">
                                Page{" "}
                                <span className="font-semibold text-slate-900">{page}</span> /{" "}
                                {pageCount}
                            </div>

                            <button
                                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                disabled={page >= pageCount}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Modal
                open={modalOpen}
                title={editing ? "Edit Charge Item" : "New Charge Item"}
                onClose={closeModal}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-600">
                            Category
                        </label>
                        <select
                            value={form.category}
                            onChange={(e) => {
                                const cat = e.target.value
                                setForm((f) => ({
                                    ...f,
                                    category: cat,
                                    // if switching away from MISC, clear headers
                                    module_header: String(cat).toUpperCase() === "MISC" ? f.module_header : "",
                                    service_header: String(cat).toUpperCase() === "MISC" ? f.service_header : "",
                                }))
                            }}
                            className={cx(
                                "mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm",
                                errors.category ? "border-rose-300" : "border-slate-200"
                            )}
                            disabled={saving}
                        >
                            {CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.value} — {c.label}
                                </option>
                            ))}
                        </select>
                        {errors.category && (
                            <div className="mt-1 text-xs text-rose-600">
                                {errors.category}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-600">Code</label>
                        <input
                            value={form.code}
                            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                            className={cx(
                                "mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
                                errors.code ? "border-rose-300" : "border-slate-200"
                            )}
                            placeholder="e.g. ADM_REG"
                            disabled={saving}
                        />
                        {errors.code && (
                            <div className="mt-1 text-xs text-rose-600">{errors.code}</div>
                        )}
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-slate-600">Name</label>
                        <input
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            className={cx(
                                "mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
                                errors.name ? "border-rose-300" : "border-slate-200"
                            )}
                            placeholder="e.g. Admission Registration Charge"
                            disabled={saving}
                        />
                        {errors.name && (
                            <div className="mt-1 text-xs text-rose-600">{errors.name}</div>
                        )}
                    </div>

                    {/* NEW: Only show for MISC */}
                    {String(form.category).toUpperCase() === "MISC" && (
                        <>
                            <div>
                                <label className="text-xs font-semibold text-slate-600">
                                    Module Header <span className="text-rose-600">*</span>
                                </label>
                                <select
                                    value={form.module_header}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, module_header: e.target.value }))
                                    }
                                    className={cx(
                                        "mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm",
                                        errors.module_header ? "border-rose-300" : "border-slate-200"
                                    )}
                                    disabled={saving}
                                >
                                    <option value="">Select module…</option>
                                    {MODULE_HEADERS.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.value}
                                        </option>
                                    ))}
                                </select>
                                {errors.module_header && (
                                    <div className="mt-1 text-xs text-rose-600">
                                        {errors.module_header}
                                    </div>
                                )}
                                <div className="mt-1 text-[11px] text-slate-500">
                                    Used for billing module filter (BillingInvoice.module)
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600">
                                    Service Header <span className="text-rose-600">*</span>
                                </label>
                                <select
                                    value={form.service_header}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, service_header: e.target.value }))
                                    }
                                    className={cx(
                                        "mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm",
                                        errors.service_header ? "border-rose-300" : "border-slate-200"
                                    )}
                                    disabled={saving}
                                >
                                    <option value="">Select service…</option>
                                    {SERVICE_HEADERS.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.value}
                                        </option>
                                    ))}
                                </select>
                                {errors.service_header && (
                                    <div className="mt-1 text-xs text-rose-600">
                                        {errors.service_header}
                                    </div>
                                )}
                                <div className="mt-1 text-[11px] text-slate-500">
                                    Maps to BillingInvoiceLine.service_group
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-slate-600">
                            Price (₹)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={form.price}
                            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                            className={cx(
                                "mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
                                errors.price ? "border-rose-300" : "border-slate-200"
                            )}
                            disabled={saving}
                        />
                        {errors.price && (
                            <div className="mt-1 text-xs text-rose-600">{errors.price}</div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-600">GST %</label>
                        <input
                            type="number"
                            step="0.01"
                            value={form.gst_rate}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, gst_rate: e.target.value }))
                            }
                            className={cx(
                                "mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
                                errors.gst_rate ? "border-rose-300" : "border-slate-200"
                            )}
                            disabled={saving}
                        />
                        {errors.gst_rate && (
                            <div className="mt-1 text-xs text-rose-600">{errors.gst_rate}</div>
                        )}
                    </div>

                    <div className="md:col-span-2 flex items-center justify-between mt-2">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={!!form.is_active}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, is_active: e.target.checked }))
                                }
                                className="h-4 w-4"
                                disabled={saving}
                            />
                            Active
                        </label>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={closeModal}
                                disabled={saving}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onSave}
                                disabled={saving}
                                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
