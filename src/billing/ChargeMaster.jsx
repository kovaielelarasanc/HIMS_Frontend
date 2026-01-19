// FILE: src/pages/masters/ChargeMaster.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
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
    Layers,
    Hash,
    BadgePercent,
    IndianRupee,
    CheckCircle2,
    XCircle,
    Sparkles,
    ShieldCheck,
    Tag,
} from "lucide-react"

const CATEGORIES = [
    { value: "ADM", label: "Admission" },
    { value: "DIET", label: "Dietary" },
    { value: "MISC", label: "Misc" },
    { value: "BLOOD", label: "Blood Bank" },
]

// ✅ Fixed Modules (module headers)
const MODULES = {
    ADM: "Admission Charges",
    ROOM: "Observation / Room Charges",
    BLOOD: "Blood Bank Charges",
    LAB: "Clinical Lab Charges",
    DIET: "Dietary Charges",
    DOC: "Doctor Fees",
    PHM: "Pharmacy Charges (Medicines)",
    PHC: "Pharmacy Charges (Consumables)",
    PROC: "Procedure Charges",
    SCAN: "Scan Charges",
    SURG: "Surgery Charges",
    XRAY: "X-Ray Charges",
    MISC: "Misc Charges",
    OTT: "OT Theater Charges",
    OTI: "OT Instrument Charges",
    OTD: "OT Device Charges",
}

// ✅ Predefined module headers for selects (from MODULES)
const PREDEFINED_HEADERS = Object.entries(MODULES).map(([value, desc]) => ({
    value,
    label: `${value} — ${desc}`,
}))

const PREDEFINED_CODES_SET = new Set(PREDEFINED_HEADERS.map((x) => x.value))

// ✅ Fixed Service Groups (service header → service_group mapping)
// (UI hint mapping: selecting service_header shows same value as group)
const HEADER_TO_SERVICE_GROUP = {
    CONSULT: "CONSULT",
    LAB: "LAB",
    RAD: "RAD",
    PHARM: "PHARM",
    OT: "OT",
    ROOM: "ROOM",
    NURSING: "NURSING",
    SURGEON: "SURGEON",
    ANESTHESIA: "ANESTHESIA",
    OT_DOCTOR: "OT_DOCTOR",
    MISC: "MISC",
    OPD: "OPD",
    IPD: "IPD",
    GENERAL: "GENERAL",
}

// ✅ Optional: nicer service labels
const SERVICE_LABELS = {
    CONSULT: "Consultation",
    LAB: "Lab Services",
    RAD: "Radiology Services",
    PHARM: "Pharmacy Services",
    OT: "Operation Theatre Services",
    ROOM: "Room Charges",
    NURSING: "Nursing Charges",
    SURGEON: "Surgeon Fees",
    ANESTHESIA: "Anesthesia Charges",
    OT_DOCTOR: "OT Doctor Fees",
    MISC: "Miscellaneous",
    OPD: "OPD Charges",
    IPD: "IPD Charges",
    GENERAL: "General Charges",
}

// ✅ Service header options for selects (from HEADER_TO_SERVICE_GROUP keys)
const SERVICE_HEADERS = Object.keys(HEADER_TO_SERVICE_GROUP).map((k) => ({
    value: k,
    label: `${k} — ${SERVICE_LABELS[k] || k.replaceAll("_", " ")}`,
}))

const SERVICE_CODES_SET = new Set(SERVICE_HEADERS.map((x) => x.value))

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

    // ✅ MISC requires fixed module/service selections
    if (category === "MISC") {
        const mh = normalizeHdr(form.module_header)
        const sh = normalizeHdr(form.service_header)

        if (!mh) errors.module_header = "Module header is required for MISC"
        if (!sh) errors.service_header = "Service header is required for MISC"

        if (mh && !PREDEFINED_CODES_SET.has(mh)) errors.module_header = "Invalid module header"
        if (sh && !SERVICE_CODES_SET.has(sh)) errors.service_header = "Invalid service header"
    }

    return errors
}

function Modal({ open, title, subtitle, children, onClose, maxW = "max-w-4xl" }) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
            <div className={cx("relative w-full", maxW)}>
                <div className="rounded-3xl border border-white/20 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200/70 bg-gradient-to-b from-slate-50 to-white">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-slate-500" />
                                    {title}
                                </div>
                                {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
                            </div>
                            <button onClick={onClose} className="p-2 rounded-2xl hover:bg-slate-100 transition" aria-label="Close">
                                <X className="h-5 w-5 text-slate-700" />
                            </button>
                        </div>
                    </div>
                    <div className="p-5">{children}</div>
                </div>
            </div>
        </div>
    )
}

function Badge({ children, tone = "slate", icon }) {
    const map = {
        slate: "bg-slate-100 text-slate-700 border-slate-200",
        green: "bg-emerald-50 text-emerald-700 border-emerald-200",
        red: "bg-rose-50 text-rose-700 border-rose-200",
        blue: "bg-sky-50 text-sky-700 border-sky-200",
        amber: "bg-amber-50 text-amber-800 border-amber-200",
        violet: "bg-violet-50 text-violet-700 border-violet-200",
    }
    return (
        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border", map[tone] || map.slate)}>
            {icon ? <span className="inline-flex">{icon}</span> : null}
            {children}
        </span>
    )
}

function Segmented({ value, onChange, options }) {
    return (
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {options.map((o) => {
                const active = String(value) === String(o.value)
                return (
                    <button
                        key={o.value}
                        onClick={() => onChange(o.value)}
                        className={cx(
                            "px-3.5 h-9 rounded-xl text-sm font-semibold transition whitespace-nowrap",
                            active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                        )}
                    >
                        {o.label ?? o.value}
                    </button>
                )
            })}
        </div>
    )
}

function IconButton({ onClick, disabled, title, children, tone = "default" }) {
    const tones = {
        default: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        dark: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
        danger: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    }
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cx(
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
                tones[tone] || tones.default
            )}
        >
            {children}
        </button>
    )
}

const SoftInput = React.forwardRef(function SoftInput(
    { value, onChange, placeholder, icon, className = "", onKeyDown },
    ref
) {
    return (
        <div className={cx("relative", className)}>
            {icon ? <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div> : null}
            <input
                ref={ref}
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className={cx(
                    "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none",
                    icon ? "pl-9" : "",
                    "focus:ring-2 focus:ring-slate-200"
                )}
            />
        </div>
    )
})

function SoftSelect({ value, onChange, children, disabled, className = "" }) {
    return (
        <select
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={cx(
                "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100 outline-none focus:ring-2 focus:ring-slate-200",
                className
            )}
        >
            {children}
        </select>
    )
}

function DividerLabel({ icon, title, subtitle }) {
    return (
        <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                {icon}
            </div>
            <div>
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                {subtitle ? <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div> : null}
            </div>
        </div>
    )
}

function withLegacyOptions(list, value, isAllowedSet) {
    const v = normalizeHdr(value)
    if (!v) return list
    if (isAllowedSet.has(v)) return list
    return [{ value: v, label: `${v} — Legacy (please change)` }, ...list]
}

function labelFrom(list, value) {
    const v = normalizeHdr(value)
    if (!v) return "—"
    const hit = list.find((x) => x.value === v)
    return hit?.label || v
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

    // Advanced filters
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [moduleHeaderFilter, setModuleHeaderFilter] = useState("")
    const [serviceHeaderFilter, setServiceHeaderFilter] = useState("")

    // Modal create/edit
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
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

    const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])
    const isMisc = useMemo(() => String(category).toUpperCase() === "MISC", [category])

    const totalsChip = useMemo(() => {
        const activeCount = rows.filter((r) => !!r.is_active).length
        const inactiveCount = rows.filter((r) => !r.is_active).length
        return { activeCount, inactiveCount }
    }, [rows])

    const moduleHeaderOptionsForModal = useMemo(
        () => withLegacyOptions(PREDEFINED_HEADERS, form.module_header, PREDEFINED_CODES_SET),
        [form.module_header]
    )
    const serviceHeaderOptionsForModal = useMemo(
        () => withLegacyOptions(SERVICE_HEADERS, form.service_header, SERVICE_CODES_SET),
        [form.service_header]
    )

    const load = useCallback(async () => {
        if (abortRef.current) abortRef.current.abort()
        const ac = new AbortController()
        abortRef.current = ac

        setLoading(true)
        try {
            const data = await listChargeItems(
                {
                    category,
                    is_active: isActiveParam,
                    search,
                    page,
                    page_size: pageSize,
                    sort: "updated_at",
                    order: "desc",
                    module_header: moduleHeaderFilter || undefined,
                    service_header: serviceHeaderFilter || undefined,
                },
                { signal: ac.signal }
            )
            if (ac.signal.aborted) return
            setRows(data?.items || [])
            setTotal(Number(data?.total || 0))
        } catch (e) {
            if (isCanceledError(e)) return
            toast.error(e?.response?.data?.detail || e?.message || "Failed to load")
        } finally {
            if (!ac.signal.aborted) setLoading(false)
        }
    }, [category, isActiveParam, search, page, pageSize, moduleHeaderFilter, serviceHeaderFilter])

    useEffect(() => {
        load()
    }, [load])

    // search debounce
    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1)
            load()
        }, 350)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    // If category is not MISC, auto-clear list filters
    useEffect(() => {
        if (String(category).toUpperCase() !== "MISC") {
            if (moduleHeaderFilter) setModuleHeaderFilter("")
            if (serviceHeaderFilter) setServiceHeaderFilter("")
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category])

    // keyboard: Ctrl/Cmd + K focus search
    const searchRef = useRef(null)
    useEffect(() => {
        const onKey = (e) => {
            const isMac = navigator.platform.toLowerCase().includes("mac")
            if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault()
                searchRef.current?.focus?.()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

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

        if (payload.category === "MISC") {
            payload.module_header = normalizeHdr(form.module_header) || null
            payload.service_header = normalizeHdr(form.service_header) || null
        } else {
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
            toast.error(e?.response?.data?.detail || e?.message || "Save failed")
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

    function clearAllFilters() {
        setSearch("")
        setActiveFilter("ACTIVE")
        setModuleHeaderFilter("")
        setServiceHeaderFilter("")
        setPage(1)
    }

    const headerHint = useMemo(() => {
        if (String(form.category).toUpperCase() !== "MISC") return ""
        const sh = normalizeHdr(form.service_header)
        if (!sh) return ""
        const mapped = HEADER_TO_SERVICE_GROUP[sh]
        if (!mapped) return ""
        const nice = SERVICE_LABELS[sh] ? ` — ${SERVICE_LABELS[sh]}` : ""
        return `Mapped to Service Group: ${mapped}${nice}`
    }, [form.category, form.service_header])

    return (
        <div className="p-4 md:p-6">
            {/* Premium background */}
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-slate-900/5 blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
                </div>

                {/* Top bar */}
                <div className="relative p-5 md:p-6 border-b border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-white">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                                    <Layers className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="text-xl font-semibold text-slate-900">Charge Master</div>
                                    <div className="text-sm text-slate-500">
                                        Fixed Modules + Fixed Service Groups · MISC requires both selections
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge tone="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                                    Active: {totalsChip.activeCount}
                                </Badge>
                                <Badge tone="red" icon={<XCircle className="h-3.5 w-3.5" />}>
                                    Inactive: {totalsChip.inactiveCount}
                                </Badge>
                                <Badge tone="slate" icon={<Hash className="h-3.5 w-3.5" />}>
                                    Total: {total}
                                </Badge>
                                <Badge tone="violet" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                                    Fixed Headers Mode
                                </Badge>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <IconButton
                                onClick={() => setShowAdvanced((s) => !s)}
                                title="Filters"
                                tone={showAdvanced ? "dark" : "default"}
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                Filters
                            </IconButton>

                            <IconButton onClick={load} title="Refresh list">
                                <RefreshCcw className={cx("h-4 w-4", loading && "animate-spin")} />
                                Refresh
                            </IconButton>

                            <IconButton onClick={openCreate} title="Create new item" tone="dark">
                                <Plus className="h-4 w-4" />
                                New Item
                            </IconButton>
                        </div>
                    </div>
                </div>

                {/* Filter strip */}
                <div className="relative px-5 md:px-6 py-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
                                <Segmented
                                    value={category}
                                    onChange={(v) => {
                                        setCategory(v)
                                        setPage(1)
                                    }}
                                    options={CATEGORIES.map((c) => ({ value: c.value, label: c.value }))}
                                />

                                <Segmented
                                    value={activeFilter}
                                    onChange={(v) => {
                                        setActiveFilter(v)
                                        setPage(1)
                                    }}
                                    options={[
                                        { value: "ACTIVE", label: "Active" },
                                        { value: "INACTIVE", label: "Inactive" },
                                        { value: "ALL", label: "All" },
                                    ]}
                                />

                                <SoftInput
                                    ref={searchRef}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search code / name… (Ctrl/Cmd+K)"
                                    icon={<Search className="h-4 w-4" />}
                                    className="w-full sm:w-[420px]"
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") setSearch("")
                                    }}
                                />
                            </div>

                            <div className="flex items-center gap-2 justify-between sm:justify-end">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500">Rows</span>
                                    <SoftSelect
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(Number(e.target.value))
                                            setPage(1)
                                        }}
                                        className="w-[120px]"
                                    >
                                        {[10, 20, 30, 50, 100].map((n) => (
                                            <option key={n} value={n}>
                                                {n}
                                            </option>
                                        ))}
                                    </SoftSelect>
                                </div>
                            </div>
                        </div>

                        {/* Advanced panel */}
                        {showAdvanced && (
                            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-slate-500" />
                                        Advanced Filters
                                        <span className="text-xs text-slate-500 font-normal">(MISC header filters only)</span>
                                    </div>
                                    <button onClick={clearAllFilters} className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline">
                                        Clear all
                                    </button>
                                </div>

                                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className={cx(!isMisc && "opacity-60")}>
                                        <label className="text-xs font-semibold text-slate-600">Module Header (MISC)</label>
                                        <div className="mt-1">
                                            <SoftSelect
                                                value={moduleHeaderFilter}
                                                onChange={(e) => {
                                                    setModuleHeaderFilter(e.target.value)
                                                    setPage(1)
                                                }}
                                                disabled={!isMisc}
                                            >
                                                <option value="">All</option>
                                                {PREDEFINED_HEADERS.map((m) => (
                                                    <option key={m.value} value={m.value}>
                                                        {m.label}
                                                    </option>
                                                ))}
                                            </SoftSelect>
                                        </div>
                                        <div className="mt-1 text-[11px] text-slate-500">Fixed module headers only.</div>
                                    </div>

                                    <div className={cx(!isMisc && "opacity-60")}>
                                        <label className="text-xs font-semibold text-slate-600">Service Group (MISC)</label>
                                        <div className="mt-1">
                                            <SoftSelect
                                                value={serviceHeaderFilter}
                                                onChange={(e) => {
                                                    setServiceHeaderFilter(e.target.value)
                                                    setPage(1)
                                                }}
                                                disabled={!isMisc}
                                            >
                                                <option value="">All</option>
                                                {SERVICE_HEADERS.map((s) => (
                                                    <option key={s.value} value={s.value}>
                                                        {s.label}
                                                    </option>
                                                ))}
                                            </SoftSelect>
                                        </div>
                                        <div className="mt-1 text-[11px] text-slate-500">Fixed service groups only.</div>
                                    </div>

                                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                                        <div className="text-xs font-semibold text-slate-700">Tip</div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            Switch to <span className="font-semibold">MISC</span> to unlock these filters.
                                            <div className="mt-1">Only your fixed modules + service groups are allowed.</div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Badge tone="blue" icon={<Layers className="h-3.5 w-3.5" />}>Module Header</Badge>
                                            <Badge tone="amber" icon={<Tag className="h-3.5 w-3.5" />}>Service Group</Badge>
                                            <Badge tone="violet" icon={<ShieldCheck className="h-3.5 w-3.5" />}>No Dynamic Create</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="relative px-5 md:px-6 pb-6">
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <div className="overflow-x-auto">
                            <table className="min-w-[980px] w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-slate-600">
                                        <th className="px-4 py-3">Code</th>
                                        <th className="px-4 py-3">Name</th>
                                        <th className="px-4 py-3">Headers</th>
                                        <th className="px-4 py-3">Price</th>
                                        <th className="px-4 py-3">GST %</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 w-[260px]">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8">
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <RefreshCcw className="h-4 w-4 animate-spin" />
                                                    Loading…
                                                </div>
                                                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {[1, 2, 3].map((i) => (
                                                        <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td className="px-4 py-10 text-slate-500" colSpan={7}>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                                                        <Search className="h-5 w-5 text-slate-500" />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-800">No items found</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            Try changing category, clearing filters, or searching by code.
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-50/60 transition">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-slate-900">{r.code}</div>
                                                    <div className="text-[11px] text-slate-500">#{r.id}</div>
                                                </td>

                                                <td className="px-4 py-3 text-slate-800">
                                                    <div className="font-medium">{r.name}</div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        Category: <span className="font-semibold">{String(r.category || "").toUpperCase()}</span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    {String(r.category).toUpperCase() === "MISC" ? (
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge tone="blue" icon={<Layers className="h-3.5 w-3.5" />}>
                                                                {normalizeHdr(r.module_header) || "—"}
                                                            </Badge>
                                                            <Badge tone="amber" icon={<Tag className="h-3.5 w-3.5" />}>
                                                                {normalizeHdr(r.service_header) || "—"}
                                                            </Badge>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 text-slate-800">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <IndianRupee className="h-4 w-4 text-slate-400" />
                                                        <span className="font-semibold">{Number(r.price || 0).toFixed(2)}</span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3 text-slate-800">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <BadgePercent className="h-4 w-4 text-slate-400" />
                                                        <span className="font-semibold">{Number(r.gst_rate || 0).toFixed(2)}</span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    {r.is_active ? (
                                                        <Badge tone="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge tone="red" icon={<XCircle className="h-3.5 w-3.5" />}>
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <IconButton onClick={() => openEdit(r)} title="Edit">
                                                            <Pencil className="h-4 w-4" />
                                                            Edit
                                                        </IconButton>

                                                        <IconButton onClick={() => onToggleActive(r)} title="Toggle active">
                                                            {r.is_active ? (
                                                                <>
                                                                    <ToggleLeft className="h-4 w-4" />
                                                                    Disable
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ToggleRight className="h-4 w-4" />
                                                                    Enable
                                                                </>
                                                            )}
                                                        </IconButton>

                                                        <IconButton onClick={() => onDelete(r)} title="Delete (soft)" tone="danger">
                                                            <Trash2 className="h-4 w-4" />
                                                            Delete
                                                        </IconButton>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-slate-500">
                            Total: <span className="font-semibold text-slate-800">{total}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Prev
                            </button>

                            <div className="text-sm text-slate-600">
                                Page <span className="font-semibold text-slate-900">{page}</span> / {pageCount}
                            </div>

                            <button
                                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                disabled={page >= pageCount}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
                title={editing ? "Edit Charge Item" : "Create Charge Item"}
                subtitle="Responsive · Fixed Modules + Fixed Service Groups · MISC requires both"
                onClose={closeModal}
                maxW="max-w-5xl"
            >
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5">
                    {/* Left: form */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <DividerLabel
                            icon={<Sparkles className="h-5 w-5" />}
                            title="Charge Details"
                            subtitle="Use headers only for MISC. Values are fixed."
                        />

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600">Category</label>
                                <div className="mt-2">
                                    <Segmented
                                        value={form.category}
                                        onChange={(cat) => {
                                            setForm((f) => ({
                                                ...f,
                                                category: cat,
                                                module_header: String(cat).toUpperCase() === "MISC" ? f.module_header : "",
                                                service_header: String(cat).toUpperCase() === "MISC" ? f.service_header : "",
                                            }))
                                            setErrors((e) => ({ ...e, category: undefined }))
                                        }}
                                        options={CATEGORIES.map((c) => ({ value: c.value, label: `${c.value} — ${c.label}` }))}
                                    />
                                </div>
                                {errors.category ? <div className="mt-2 text-xs text-rose-600">{errors.category}</div> : null}
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600">Code</label>
                                <div className="mt-1">
                                    <SoftInput
                                        value={form.code}
                                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                        placeholder="e.g. ADM_REG"
                                        icon={<Hash className="h-4 w-4" />}
                                    />
                                </div>
                                {errors.code ? <div className="mt-2 text-xs text-rose-600">{errors.code}</div> : null}
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600">Status</label>
                                <div className="mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-slate-800">{form.is_active ? "Active" : "Inactive"}</div>
                                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={!!form.is_active}
                                                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                                                className="h-4 w-4"
                                                disabled={saving}
                                            />
                                            Enabled
                                        </label>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">Soft delete makes item inactive (safe for billing history).</div>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600">Name</label>
                                <div className="mt-1">
                                    <SoftInput
                                        value={form.name}
                                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                        placeholder="e.g. Admission Registration Charge"
                                        icon={<Sparkles className="h-4 w-4" />}
                                    />
                                </div>
                                {errors.name ? <div className="mt-2 text-xs text-rose-600">{errors.name}</div> : null}
                            </div>

                            {/* MISC headers */}
                            {String(form.category).toUpperCase() === "MISC" ? (
                                <>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600">
                                            Module Header <span className="text-rose-600">*</span>
                                        </label>
                                        <div className="mt-1">
                                            <SoftSelect
                                                value={form.module_header}
                                                onChange={(e) => setForm((f) => ({ ...f, module_header: e.target.value }))}
                                                disabled={saving}
                                            >
                                                <option value="">Select module…</option>
                                                {moduleHeaderOptionsForModal.map((m) => (
                                                    <option key={m.value} value={m.value}>
                                                        {m.label}
                                                    </option>
                                                ))}
                                            </SoftSelect>
                                        </div>
                                        {errors.module_header ? <div className="mt-2 text-xs text-rose-600">{errors.module_header}</div> : null}
                                        <div className="mt-1 text-[11px] text-slate-500">Fixed modules only.</div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-slate-600">
                                            Service Group <span className="text-rose-600">*</span>
                                        </label>
                                        <div className="mt-1">
                                            <SoftSelect
                                                value={form.service_header}
                                                onChange={(e) => setForm((f) => ({ ...f, service_header: e.target.value }))}
                                                disabled={saving}
                                            >
                                                <option value="">Select service group…</option>
                                                {serviceHeaderOptionsForModal.map((s) => (
                                                    <option key={s.value} value={s.value}>
                                                        {s.label}
                                                    </option>
                                                ))}
                                            </SoftSelect>
                                        </div>

                                        {errors.service_header ? <div className="mt-2 text-xs text-rose-600">{errors.service_header}</div> : null}

                                        {headerHint ? (
                                            <div className="mt-2 text-[11px] text-slate-600">
                                                <span className="font-semibold">Mapping:</span> {headerHint}
                                            </div>
                                        ) : (
                                            <div className="mt-1 text-[11px] text-slate-500">Pick correct fixed service group.</div>
                                        )}
                                    </div>
                                </>
                            ) : null}

                            <div>
                                <label className="text-xs font-semibold text-slate-600">Price (₹)</label>
                                <div className="mt-1">
                                    <SoftInput
                                        value={form.price}
                                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                        placeholder="0.00"
                                        icon={<IndianRupee className="h-4 w-4" />}
                                    />
                                </div>
                                {errors.price ? <div className="mt-2 text-xs text-rose-600">{errors.price}</div> : null}
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600">GST %</label>
                                <div className="mt-1">
                                    <SoftInput
                                        value={form.gst_rate}
                                        onChange={(e) => setForm((f) => ({ ...f, gst_rate: e.target.value }))}
                                        placeholder="0.00"
                                        icon={<BadgePercent className="h-4 w-4" />}
                                    />
                                </div>
                                {errors.gst_rate ? <div className="mt-2 text-xs text-rose-600">{errors.gst_rate}</div> : null}
                            </div>
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                onClick={closeModal}
                                disabled={saving}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onSave}
                                disabled={saving}
                                className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>

                    {/* Right: guidance */}
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
                        <DividerLabel
                            icon={<ShieldCheck className="h-5 w-5" />}
                            title="Rules & Routing"
                            subtitle="Simple + NABH-friendly (no dynamic masters)."
                        />

                        <div className="mt-4 space-y-3 text-sm text-slate-700">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="font-semibold text-slate-900">MISC requires two selections</div>
                                <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                                    For <span className="font-semibold">MISC</span>, choose:
                                    <div className="mt-1">
                                        <span className="font-semibold">Module Header</span> (fixed modules) +{" "}
                                        <span className="font-semibold">Service Group</span> (fixed service groups).
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="font-semibold text-slate-900">Fixed Modules</div>
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {PREDEFINED_HEADERS.slice(0, 10).map((h) => (
                                        <div key={h.value} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                            <div className="text-xs font-semibold text-slate-900">{h.value}</div>
                                            <div className="text-[11px] text-slate-500">{MODULES[h.value]}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 text-[11px] text-slate-500">
                                    Total modules: <span className="font-semibold">{PREDEFINED_HEADERS.length}</span>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="font-semibold text-slate-900">Fixed Service Groups</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {SERVICE_HEADERS.map((s) => (
                                        <Badge key={s.value} tone="violet">
                                            {s.value}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="font-semibold text-slate-900">Safety</div>
                                <div className="mt-1 text-xs text-slate-500">
                                    Prefer <span className="font-semibold">soft delete</span> (inactive) to preserve billing history.
                                </div>
                            </div>

                            {String(form.category).toUpperCase() === "MISC" && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="font-semibold text-slate-900">Live Preview</div>
                                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                                        <div>
                                            <span className="font-semibold">Module:</span>{" "}
                                            {form.module_header ? labelFrom(PREDEFINED_HEADERS, form.module_header) : "—"}
                                        </div>
                                        <div>
                                            <span className="font-semibold">Service:</span>{" "}
                                            {form.service_header ? labelFrom(SERVICE_HEADERS, form.service_header) : "—"}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
