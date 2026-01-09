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
} from "lucide-react"

const CATEGORIES = [
    { value: "ADM", label: "Admission" },
    { value: "DIET", label: "Dietary" },
    { value: "MISC", label: "Misc" },
    { value: "BLOOD", label: "Blood Bank" },
]

const cx = (...a) => a.filter(Boolean).join(" ")

function toNumStr(v) {
    const s = String(v ?? "")
    return s === "" ? "" : s
}

function normalizeCode(code) {
    return String(code || "")
        .trim()
        .toUpperCase()
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

    return errors
}

function Modal({ open, title, children, onClose }) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200">
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
        <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", map[tone] || map.slate)}>
            {children}
        </span>
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

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null) // row or null
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        category: "ADM",
        code: "",
        name: "",
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

    const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

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
    }, [category, activeFilter, page, pageSize])

    // search debounce
    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1)
            load()
        }, 350)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    function openCreate() {
        setEditing(null)
        setErrors({})
        setForm({
            category,
            code: "",
            name: "",
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

        const v = validate(payload)
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
        const ok = window.confirm(`Delete "${row.name}"?\n\nOK = Soft delete (inactive).\nCancel = abort.`)
        if (!ok) return
        try {
            await deleteChargeItem(row.id, { hard: false })
            toast.success("Deleted (inactive)")
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || e?.message || "Failed")
        }
    }

    return (
        <div className="p-4 md:p-6">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Header */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 md:p-5 border-b border-slate-200">
                    <div>
                        <div className="text-xl font-semibold text-slate-900">Charge Master</div>
                        <div className="text-sm text-slate-500">ADM / DIET / MISC / BLOOD master items</div>
                    </div>

                    <div className="flex items-center gap-2">
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
                <div className="p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <select
                            value={category}
                            onChange={(e) => { setCategory(e.target.value); setPage(1) }}
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
                            onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }}
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
                                placeholder="Search by code or name…"
                                className="h-10 w-full md:w-80 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Rows:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        >
                            {[10, 20, 30, 50, 100].map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="px-4 md:px-5 pb-5">
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr className="text-left text-slate-600">
                                    <th className="px-4 py-3">Code</th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3">GST %</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 w-[220px]">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td className="px-4 py-6 text-slate-500" colSpan={6}>
                                            Loading…
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td className="px-4 py-6 text-slate-500" colSpan={6}>
                                            No items found.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r) => (
                                        <tr key={r.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-3 font-semibold text-slate-900">{r.code}</td>
                                            <td className="px-4 py-3 text-slate-800">{r.name}</td>
                                            <td className="px-4 py-3 text-slate-800">₹ {Number(r.price || 0).toFixed(2)}</td>
                                            <td className="px-4 py-3 text-slate-800">{Number(r.gst_rate || 0).toFixed(2)}</td>
                                            <td className="px-4 py-3">
                                                {r.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}
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
                                                        {r.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
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
                            Total: <span className="font-semibold text-slate-800">{total}</span>
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
                                Page <span className="font-semibold text-slate-900">{page}</span> / {pageCount}
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
                        <label className="text-xs font-semibold text-slate-600">Category</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
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
                        {errors.category && <div className="mt-1 text-xs text-rose-600">{errors.category}</div>}
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
                        {errors.code && <div className="mt-1 text-xs text-rose-600">{errors.code}</div>}
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
                        {errors.name && <div className="mt-1 text-xs text-rose-600">{errors.name}</div>}
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-600">Price (₹)</label>
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
                        {errors.price && <div className="mt-1 text-xs text-rose-600">{errors.price}</div>}
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-600">GST %</label>
                        <input
                            type="number"
                            step="0.01"
                            value={form.gst_rate}
                            onChange={(e) => setForm((f) => ({ ...f, gst_rate: e.target.value }))}
                            className={cx(
                                "mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
                                errors.gst_rate ? "border-rose-300" : "border-slate-200"
                            )}
                            disabled={saving}
                        />
                        {errors.gst_rate && <div className="mt-1 text-xs text-rose-600">{errors.gst_rate}</div>}
                    </div>

                    <div className="md:col-span-2 flex items-center justify-between mt-2">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={!!form.is_active}
                                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
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
