import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
    Plus,
    RefreshCw,
    Trash2,
    Search,
    X,
    Barcode,
    ChevronRight,
    ClipboardList,
    Building2,
    UserRound,
    Stethoscope,
    CalendarRange,
} from "lucide-react"

import { useCanFn } from "@/hooks/useCan"
import { invListLocations } from "@/api/inventoryIndent"
import {
    invListConsumptionItems,
    invCreatePatientConsumption,
    invListPatientConsumptions,
} from "@/api/inventoryConsumption"
import { listPatients } from "@/api/patients"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

function cx(...x) {
    return x.filter(Boolean).join(" ")
}

function fmtDateTime(dt) {
    if (!dt) return "-"
    const d = new Date(dt)
    return d.toLocaleString()
}

/**
 * Handles:
 * 1) axios response { data: { status, data, error } }
 * 2) already unwrapped payload { status, data }
 * 3) raw array/object
 */
function unwrapAny(res) {
    const payload = res?.data ?? res
    if (payload && typeof payload === "object" && "status" in payload) {
        if (!payload.status) {
            const msg = payload?.error?.msg || payload?.error || "Something went wrong"
            throw new Error(msg)
        }
        return payload.data
    }
    return payload
}

function GlassCard({ className, ...props }) {
    return (
        <Card
            className={cx(
                "rounded-2xl border-slate-200/70 bg-white/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60",
                className
            )}
            {...props}
        />
    )
}

/* -------------------------
   Patient Picker (search dialog)
------------------------- */
function PatientPicker({ value, onChange }) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState("")
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])

    async function search() {
        try {
            setLoading(true)
            const res = await listPatients({ q, limit: 25 })
            const data = unwrapAny(res)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e?.message || "Failed to search patients")
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!open) return
        search()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    return (
        <>
            <div className="flex gap-2">
                <Input
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value ? e.target.value : null)}
                    placeholder="Patient ID"
                    className="h-10 rounded-xl bg-white/80"
                />
                <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl bg-white/70"
                    onClick={() => setOpen(true)}
                >
                    <Search className="mr-2 h-4 w-4" />
                    Find
                </Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Search patient</DialogTitle>
                        <DialogDescription>Search and select a patient</DialogDescription>
                    </DialogHeader>

                    <div className="flex gap-2">
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search by name / phone / patient id"
                            className="h-10 rounded-xl"
                        />
                        <Button className="h-10 rounded-xl" onClick={search} disabled={loading}>
                            {loading ? "Searching..." : "Search"}
                        </Button>
                    </div>

                    <div className="mt-3 max-h-[380px] overflow-auto rounded-2xl border bg-white">
                        {rows?.length ? (
                            <div className="divide-y">
                                {rows.map((p) => (
                                    <button
                                        key={p.id}
                                        className="w-full px-4 py-3 text-left transition hover:bg-slate-50"
                                        onClick={() => {
                                            onChange(p.id)
                                            setOpen(false)
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-medium">
                                                {p.first_name || p.name || `Patient #${p.id}`}
                                            </div>
                                            <Badge variant="secondary" className="rounded-full">
                                                ID: {p.id}
                                            </Badge>
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">
                                            {p.patient_id ? `UHID: ${p.patient_id} · ` : ""}
                                            {p.phone || p.mobile || ""}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-sm text-slate-500">{loading ? "Loading..." : "No results"}</div>
                        )}
                    </div>

                    <DialogFooter className="flex items-center justify-between gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                        <div className="text-xs text-slate-500">
                            {value ? `Selected: Patient #${value}` : "No patient selected"}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

/* -------------------------
   Add Items Dialog (searchable)
------------------------- */
function AddItemDialog({ open, onOpenChange, eligibleItems, onAddItem }) {
    const [q, setQ] = useState("")
    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase()
        if (!s) return eligibleItems
        return eligibleItems.filter((it) => {
            const name = String(it?.name || "").toLowerCase()
            const code = String(it?.code || "").toLowerCase()
            return name.includes(s) || code.includes(s)
        })
    }, [eligibleItems, q])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Add items</DialogTitle>
                    <DialogDescription>Search and tap to add</DialogDescription>
                </DialogHeader>

                <div className="flex gap-2">
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search by item name / code"
                        className="h-10 rounded-xl"
                    />
                    <Button variant="outline" className="h-10 rounded-xl" onClick={() => setQ("")}>
                        Clear
                    </Button>
                </div>

                <div className="mt-3 max-h-[420px] overflow-auto rounded-2xl border bg-white">
                    {filtered?.length ? (
                        <div className="divide-y">
                            {filtered.map((it) => (
                                <button
                                    key={it.item_id}
                                    className="w-full px-4 py-3 text-left transition hover:bg-slate-50"
                                    onClick={() => onAddItem(it.item_id)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium">
                                                {it.name}{" "}
                                                <span className="text-xs text-slate-500">({it.code})</span>
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                Unit: {it.unit} · Stock: {it.on_hand_qty}
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="rounded-full">
                                            Add
                                        </Badge>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-sm text-slate-500">No items match.</div>
                    )}
                </div>

                <DialogFooter>
                    <Button className="rounded-xl" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/* -------------------------
   Main Page
------------------------- */
const ENCOUNTER_TYPES = ["OP", "IP", "OT", "ER"]

export default function WardPatientUsagePage() {
    const { canAny } = useCanFn()

    const canView = canAny(["inventory.consume.view", "inventory.manage", "inventory.view"])
    const canCreate = canAny(["inventory.consume.create", "inventory.manage"])

    const [locations, setLocations] = useState([])
    const [loadingLocations, setLoadingLocations] = useState(false)

    const [filters, setFilters] = useState({
        location_id: "",
        patient_id: "",
        encounter_type: "",
        encounter_id: "",
        date_from: "",
        date_to: "",
    })

    const [rows, setRows] = useState([])
    const [loadingList, setLoadingList] = useState(false)

    // Create panel
    const [form, setForm] = useState({
        location_id: "",
        patient_id: null,
        encounter_type: "IP",
        encounter_id: "",
        notes: "",
        items: [],
    })

    const [eligibleItems, setEligibleItems] = useState([])
    const [loadingEligible, setLoadingEligible] = useState(false)
    const [saving, setSaving] = useState(false)

    const [openAddItems, setOpenAddItems] = useState(false)
    const [scanCode, setScanCode] = useState("")
    const scanRef = useRef(null)

    async function loadLocations() {
        try {
            setLoadingLocations(true)
            const res = await invListLocations({ is_active: true })
            const data = unwrapAny(res)
            setLocations(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e?.message || "Failed to load locations")
        } finally {
            setLoadingLocations(false)
        }
    }

    async function loadList() {
        if (!canView) return
        try {
            setLoadingList(true)
            const params = {
                limit: 50,
                offset: 0,
                ...(filters.location_id ? { location_id: Number(filters.location_id) } : {}),
                ...(filters.patient_id ? { patient_id: Number(filters.patient_id) } : {}),
                ...(filters.encounter_type && filters.encounter_id
                    ? { encounter_type: filters.encounter_type, encounter_id: Number(filters.encounter_id) }
                    : {}),
                ...(filters.date_from ? { date_from: filters.date_from } : {}),
                ...(filters.date_to ? { date_to: filters.date_to } : {}),
            }

            const res = await invListPatientConsumptions(params)
            console.log(res, "resss");

            const data = unwrapAny(res)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e?.message || "Failed to load usage list")
            setRows([])
        } finally {
            setLoadingList(false)
        }
    }

    async function loadEligible() {
        const locId = Number(form.location_id)
        const patId = form.patient_id ? Number(form.patient_id) : null

        if (!locId || !patId) {
            setEligibleItems([])
            return
        }

        try {
            setLoadingEligible(true)
            const res = await invListConsumptionItems({
                location_id: locId,
                // patient_id: patId, // ✅ enable patient issued restriction if backend supports it
                // encounter_type: form.encounter_type || undefined,
                // encounter_id: form.encounter_id ? Number(form.encounter_id) : undefined,
                limit: 250,
            })
            console.log(res, "1234567890");

            const data = unwrapAny(res)
            setEligibleItems(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e?.message || "Failed to load items")
            setEligibleItems([])
        } finally {
            setLoadingEligible(false)
        }
    }

    useEffect(() => {
        loadLocations()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        loadList()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView])

    useEffect(() => {
        loadEligible()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.location_id, form.patient_id, form.encounter_type, form.encounter_id])

    // Auto-prefill create location from filter location
    useEffect(() => {
        if (!filters.location_id) return
        setForm((s) => (s.location_id ? s : { ...s, location_id: filters.location_id }))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.location_id])

    const locationMap = useMemo(() => {
        const m = new Map()
        for (const l of locations) m.set(l.id, l)
        return m
    }, [locations])

    const eligibleMap = useMemo(() => {
        const m = new Map()
        for (const it of eligibleItems) m.set(it.item_id, it)
        return m
    }, [eligibleItems])

    const eligibleByCode = useMemo(() => {
        const m = new Map()
        for (const it of eligibleItems) {
            const code = String(it?.code || "").trim().toUpperCase()
            if (code) m.set(code, it)
        }
        return m
    }, [eligibleItems])

    function addItem(item_id) {
        if (!item_id) return
        const exists = form.items.some((x) => x.item_id === item_id)
        if (exists) return toast.message("Item already added")

        const info = eligibleMap.get(item_id)
        setForm((s) => ({
            ...s,
            items: [
                ...s.items,
                {
                    item_id,
                    qty: 1,
                    remark: "",
                    _name: info?.name || "",
                    _code: info?.code || "",
                    _unit: info?.unit || "unit",
                    _on_hand: info?.on_hand_qty ?? null,
                },
            ],
        }))
    }

    function removeItem(item_id) {
        setForm((s) => ({ ...s, items: s.items.filter((x) => x.item_id !== item_id) }))
    }

    function clearCreate() {
        setForm({
            location_id: filters.location_id || "",
            patient_id: null,
            encounter_type: "IP",
            encounter_id: "",
            notes: "",
            items: [],
        })
        setEligibleItems([])
        setScanCode("")
    }

    function validateCreate() {
        const location_id = Number(form.location_id)
        const patient_id = form.patient_id ? Number(form.patient_id) : null

        if (!canCreate) return "Not permitted"
        if (!location_id) return "Select Ward/OT location"
        if (!patient_id) return "Select patient"
        if (!form.encounter_type) return "Select encounter type"
        if (!form.encounter_id || Number(form.encounter_id) <= 0) return "Enter encounter ID"
        if (!form.items?.length) return "Add at least 1 item"

        for (const it of form.items) {
            const q = Number(it.qty)
            if (!q || q <= 0) return `Qty must be > 0 for item ${it._code || it.item_id}`
        }
        return null
    }

    async function submit() {
        const err = validateCreate()
        if (err) return toast.error(err)

        const payload = {
            location_id: Number(form.location_id),
            patient_id: Number(form.patient_id),
            encounter_type: form.encounter_type,
            encounter_id: Number(form.encounter_id),
            notes: form.notes || "",
            items: form.items.map((x) => ({
                item_id: x.item_id,
                qty: Number(x.qty),
                remark: x.remark || "",
            })),
        }

        try {
            setSaving(true)
            await invCreatePatientConsumption(payload)
            toast.success("Patient usage saved")
            clearCreate()
            await loadList()
        } catch (e) {
            toast.error(e?.message || "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    function tryScanAdd() {
        const code = String(scanCode || "").trim().toUpperCase()
        if (!code) return
        const it = eligibleByCode.get(code)
        if (!it) {
            toast.error(`Item not found for code: ${code}`)
            return
        }
        addItem(it.item_id)
        setScanCode("")
    }

    const listCount = rows?.length || 0

    return (
        <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-white">
            <div className="mx-auto max-w-[1400px] p-4 md:p-6 space-y-4">
                {/* TOP: Sticky Apple-like filter bar */}
                <div className="sticky top-2 z-10">
                    <GlassCard className="overflow-hidden">
                        <div className="px-4 py-4 md:px-5 md:py-5">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CardTitle className="text-xl md:text-2xl">Ward Patient Usage</CardTitle>
                                        <Badge variant="outline" className="rounded-full text-[11px]">
                                            Billable Consumption
                                        </Badge>
                                        {!canView && (
                                            <Badge className="rounded-full bg-red-50 text-red-700 hover:bg-red-50">
                                                No View Permission
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription className="mt-1">
                                        Premium nurse workflow: filter at top, create on left, list on right.
                                    </CardDescription>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="rounded-xl bg-white/70"
                                        onClick={loadList}
                                        disabled={loadingList || !canView}
                                        title={!canView ? "No permission" : "Refresh"}
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Refresh
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="rounded-xl bg-white/70"
                                        onClick={() => {
                                            setFilters({
                                                location_id: "",
                                                patient_id: "",
                                                encounter_type: "",
                                                encounter_id: "",
                                                date_from: "",
                                                date_to: "",
                                            })
                                            setTimeout(loadList, 0)
                                        }}
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
                                {/* Location */}
                                <div className="lg:col-span-4">
                                    <Label className="text-xs text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <Building2 className="h-3.5 w-3.5" />
                                            Ward/OT Location
                                        </span>
                                    </Label>
                                    <select
                                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-200"
                                        value={filters.location_id}
                                        onChange={(e) => setFilters((s) => ({ ...s, location_id: e.target.value }))}
                                        disabled={loadingLocations}
                                    >
                                        <option value="">All locations</option>
                                        {locations.map((l) => (
                                            <option key={l.id} value={l.id}>
                                                {l.name} ({l.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Patient */}
                                <div className="lg:col-span-2">
                                    <Label className="text-xs text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <UserRound className="h-3.5 w-3.5" />
                                            Patient ID
                                        </span>
                                    </Label>
                                    <Input
                                        className="mt-1 h-10 rounded-xl bg-white/80"
                                        value={filters.patient_id}
                                        onChange={(e) => setFilters((s) => ({ ...s, patient_id: e.target.value }))}
                                        placeholder="e.g. 123"
                                    />
                                </div>

                                {/* Encounter filter */}
                                <div className="lg:col-span-2">
                                    <Label className="text-xs text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <Stethoscope className="h-3.5 w-3.5" />
                                            Encounter
                                        </span>
                                    </Label>
                                    <div className="mt-1 grid grid-cols-2 gap-2">
                                        <select
                                            className="h-10 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
                                            value={filters.encounter_type}
                                            onChange={(e) => setFilters((s) => ({ ...s, encounter_type: e.target.value }))}
                                        >
                                            <option value="">Type</option>
                                            {ENCOUNTER_TYPES.map((t) => (
                                                <option key={t} value={t}>
                                                    {t}
                                                </option>
                                            ))}
                                        </select>
                                        <Input
                                            className="h-10 rounded-xl bg-white/80"
                                            value={filters.encounter_id}
                                            onChange={(e) => setFilters((s) => ({ ...s, encounter_id: e.target.value }))}
                                            placeholder="ID"
                                            inputMode="numeric"
                                        />
                                    </div>
                                </div>

                                {/* From */}
                                <div className="lg:col-span-2">
                                    <Label className="text-xs text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <CalendarRange className="h-3.5 w-3.5" />
                                            From
                                        </span>
                                    </Label>
                                    <Input
                                        type="date"
                                        className="mt-1 h-10 rounded-xl bg-white/80"
                                        value={filters.date_from}
                                        onChange={(e) => setFilters((s) => ({ ...s, date_from: e.target.value }))}
                                    />
                                </div>

                                {/* To */}
                                <div className="lg:col-span-1">
                                    <Label className="text-xs text-slate-500">To</Label>
                                    <Input
                                        type="date"
                                        className="mt-1 h-10 rounded-xl bg-white/80"
                                        value={filters.date_to}
                                        onChange={(e) => setFilters((s) => ({ ...s, date_to: e.target.value }))}
                                    />
                                </div>

                                {/* Apply */}
                                <div className="lg:col-span-1 flex items-end">
                                    <Button className="h-10 w-full rounded-xl" onClick={loadList} disabled={!canView || loadingList}>
                                        Apply
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                                <div>
                                    Showing <span className="font-medium text-slate-700">{listCount}</span> entries
                                </div>
                                <div className="hidden md:block">Tip: Filter by Ward + Encounter for quick audits.</div>
                            </div>
                        </div>
                    </GlassCard>
                </div>

                {/* BODY */}
                <div className="grid gap-4 lg:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]">
                    {/* LEFT: Create */}
                    <GlassCard className="h-fit">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base">Create Usage</CardTitle>
                                    <CardDescription className="mt-1">
                                        Location <ChevronRight className="inline h-3 w-3" /> Patient{" "}
                                        <ChevronRight className="inline h-3 w-3" /> Encounter{" "}
                                        <ChevronRight className="inline h-3 w-3" /> Items
                                    </CardDescription>
                                </div>

                                <Badge
                                    variant="secondary"
                                    className={cx(
                                        "rounded-full",
                                        canCreate ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                    )}
                                >
                                    {canCreate ? "Create Enabled" : "No Create Permission"}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* Location */}
                            <div>
                                <Label className="text-xs text-slate-500">Ward/OT Location</Label>
                                <select
                                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-200"
                                    value={form.location_id}
                                    onChange={(e) => setForm((s) => ({ ...s, location_id: e.target.value }))}
                                    disabled={!canCreate}
                                >
                                    <option value="">Select location</option>
                                    {locations.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.name} ({l.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Patient */}
                            <div>
                                <Label className="text-xs text-slate-500">Patient</Label>
                                <div className="mt-1">
                                    <PatientPicker
                                        value={form.patient_id}
                                        onChange={(id) => setForm((s) => ({ ...s, patient_id: id }))}
                                    />
                                </div>
                            </div>

                            {/* Encounter */}
                            <div className="rounded-2xl border border-slate-200 bg-white/60 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="font-medium">Encounter Link</div>
                                        <div className="mt-0.5 text-xs text-slate-500">
                                            Required for billing sync (OP/IP/OT/ER).
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="rounded-full text-[11px]">
                                        Required
                                    </Badge>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                        <Label className="text-xs text-slate-500">Encounter Type</Label>
                                        <div className="mt-1 flex flex-wrap gap-2">
                                            {ENCOUNTER_TYPES.map((t) => {
                                                const active = form.encounter_type === t
                                                return (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        className={cx(
                                                            "h-9 rounded-xl px-3 text-sm transition",
                                                            active
                                                                ? "bg-slate-900 text-white"
                                                                : "bg-white border border-slate-200 hover:bg-slate-50"
                                                        )}
                                                        onClick={() => setForm((s) => ({ ...s, encounter_type: t }))}
                                                        disabled={!canCreate}
                                                    >
                                                        {t}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-xs text-slate-500">Encounter ID</Label>
                                        <Input
                                            className="mt-1 h-10 rounded-xl bg-white"
                                            value={form.encounter_id}
                                            onChange={(e) => setForm((s) => ({ ...s, encounter_id: e.target.value }))}
                                            placeholder="Example: OP visit id / IP admission id / OT case id"
                                            inputMode="numeric"
                                            disabled={!canCreate}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <Label className="text-xs text-slate-500">Notes</Label>
                                <Input
                                    className="mt-1 h-10 rounded-xl bg-white/80"
                                    value={form.notes}
                                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                                    placeholder="Optional notes"
                                    disabled={!canCreate}
                                />
                            </div>

                            {/* Items */}
                            <div className="rounded-2xl border border-slate-200 bg-white/60 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-medium">Medicines / Consumables</div>
                                        <div className="mt-0.5 text-xs text-slate-500">
                                            {loadingEligible
                                                ? "Loading eligible items..."
                                                : "Items load after Location + Patient + Encounter."}
                                        </div>
                                    </div>

                                    <Badge variant="outline" className="rounded-full text-[11px]">
                                        Lines: {form.items?.length || 0}
                                    </Badge>
                                </div>

                                {/* Scan / code add */}
                                <div className="mt-3">
                                    <Label className="text-xs text-slate-500">Scan / Enter Item Code</Label>
                                    <div className="mt-1 flex gap-2">
                                        <Input
                                            ref={scanRef}
                                            className="h-10 rounded-xl bg-white"
                                            value={scanCode}
                                            onChange={(e) => setScanCode(e.target.value)}
                                            placeholder="Scan barcode or type item code"
                                            disabled={!form.location_id || !form.patient_id || !form.encounter_id || loadingEligible || !canCreate}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault()
                                                    tryScanAdd()
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 rounded-xl bg-white"
                                            onClick={tryScanAdd}
                                            disabled={!scanCode || !canCreate}
                                            title="Add by code"
                                        >
                                            <Barcode className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-500">
                                        Tip: barcode scanner usually types code + Enter.
                                    </div>
                                </div>

                                {/* Add item dialog */}
                                <div className="mt-3 flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 rounded-xl bg-white"
                                        onClick={() => setOpenAddItems(true)}
                                        disabled={!form.location_id || !form.patient_id || !form.encounter_id || loadingEligible || !canCreate}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add items
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 rounded-xl bg-white"
                                        onClick={() => loadEligible()}
                                        disabled={!form.location_id || !form.patient_id || !form.encounter_id || loadingEligible}
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Reload
                                    </Button>
                                </div>

                                {/* Lines */}
                                <div className="mt-3 space-y-2">
                                    {form.items?.length ? (
                                        form.items.map((x) => (
                                            <div key={x.item_id} className="rounded-2xl border border-slate-200 bg-white p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="font-medium truncate">
                                                            {x._name || `Item #${x.item_id}`}{" "}
                                                            <span className="text-xs text-slate-500">({x._code})</span>
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Unit: {x._unit} · Stock: {x._on_hand ?? "—"}
                                                        </div>
                                                    </div>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="rounded-xl"
                                                        onClick={() => removeItem(x.item_id)}
                                                        disabled={!canCreate}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>

                                                <div className="mt-3 grid grid-cols-1 gap-3">
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="col-span-1">
                                                            <Label className="text-xs text-slate-500">Qty</Label>
                                                            <Input
                                                                className="mt-1 h-10 rounded-xl"
                                                                type="number"
                                                                min="0"
                                                                step="1"
                                                                value={x.qty}
                                                                onChange={(e) => {
                                                                    const v = e.target.value
                                                                    setForm((s) => ({
                                                                        ...s,
                                                                        items: s.items.map((i) =>
                                                                            i.item_id === x.item_id ? { ...i, qty: v } : i
                                                                        ),
                                                                    }))
                                                                }}
                                                                disabled={!canCreate}
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <Label className="text-xs text-slate-500">Remark</Label>
                                                            <Input
                                                                className="mt-1 h-10 rounded-xl"
                                                                value={x.remark}
                                                                onChange={(e) => {
                                                                    const v = e.target.value
                                                                    setForm((s) => ({
                                                                        ...s,
                                                                        items: s.items.map((i) =>
                                                                            i.item_id === x.item_id ? { ...i, remark: v } : i
                                                                        ),
                                                                    }))
                                                                }}
                                                                placeholder="Optional remark"
                                                                disabled={!canCreate}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                                            Add items to continue
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1">
                                <Button variant="outline" className="rounded-xl bg-white/70" onClick={clearCreate} disabled={saving}>
                                    Clear Form
                                </Button>

                                <Button className="ml-auto rounded-xl" onClick={submit} disabled={saving || !canCreate}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {saving ? "Saving..." : "Save Usage"}
                                </Button>
                            </div>

                            {!canCreate && <div className="text-sm text-red-600">You don’t have permission to add usage.</div>}
                        </CardContent>
                    </GlassCard>

                    {/* RIGHT: List */}
                    <GlassCard>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base">Usage List</CardTitle>
                                    <CardDescription className="mt-1">Posted usage entries (audit-friendly)</CardDescription>
                                </div>
                                <Badge variant="secondary" className="rounded-full">
                                    <ClipboardList className="mr-2 h-4 w-4" />
                                    {listCount}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {/* Desktop table */}
                            <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">Date/Time</th>
                                            <th className="px-4 py-3 text-left font-medium">Doc</th>
                                            <th className="px-4 py-3 text-left font-medium">Location</th>
                                            <th className="px-4 py-3 text-left font-medium">Patient</th>
                                            <th className="px-4 py-3 text-left font-medium">Encounter</th>
                                            <th className="px-4 py-3 text-right font-medium">Lines</th>
                                            <th className="px-4 py-3 text-right font-medium">Total Qty</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y">
                                        {loadingList ? (
                                            <tr>
                                                <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>
                                                    Loading...
                                                </td>
                                            </tr>
                                        ) : rows?.length ? (
                                            rows.map((r) => (
                                                <tr key={r.consumption_id} className="transition hover:bg-slate-50/60">
                                                    <td className="px-4 py-3">{fmtDateTime(r.posted_at)}</td>

                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">{r.consumption_number || `#${r.consumption_id}`}</div>
                                                        <div className="text-xs text-slate-500">ID: {r.consumption_id}</div>
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        {locationMap.get(r.location_id)?.name || `Loc #${r.location_id}`}
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        <Badge variant="secondary" className="rounded-full">
                                                            {r.patient_id ? `Patient #${r.patient_id}` : "—"}
                                                        </Badge>
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        {r.encounter_type && r.encounter_id ? (
                                                            <Badge variant="outline" className="rounded-full">
                                                                {r.encounter_type} • {r.encounter_id}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">{r.total_lines}</td>
                                                    <td className="px-4 py-3 text-right">{r.total_qty}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td className="px-4 py-12 text-center text-slate-500" colSpan={7}>
                                                    No usage entries found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="md:hidden space-y-3">
                                {loadingList ? (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                                        Loading...
                                    </div>
                                ) : rows?.length ? (
                                    rows.map((r) => (
                                        <div key={r.consumption_id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="font-medium truncate">
                                                        {r.consumption_number || `#${r.consumption_id}`}
                                                    </div>
                                                    <div className="mt-1 text-xs text-slate-500">{fmtDateTime(r.posted_at)}</div>
                                                </div>
                                                <Badge variant="secondary" className="rounded-full">
                                                    {r.total_lines} lines
                                                </Badge>
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                                <div className="rounded-xl bg-slate-50 p-2">
                                                    <div className="text-xs text-slate-500">Location</div>
                                                    <div className="font-medium">
                                                        {locationMap.get(r.location_id)?.name || `Loc #${r.location_id}`}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 p-2">
                                                    <div className="text-xs text-slate-500">Patient</div>
                                                    <div className="font-medium">{r.patient_id ? `#${r.patient_id}` : "—"}</div>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 p-2">
                                                    <div className="text-xs text-slate-500">Encounter</div>
                                                    <div className="font-medium">
                                                        {r.encounter_type && r.encounter_id ? `${r.encounter_type} • ${r.encounter_id}` : "—"}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 p-2">
                                                    <div className="text-xs text-slate-500">Total Qty</div>
                                                    <div className="font-medium">{r.total_qty}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                                        No usage entries found
                                    </div>
                                )}
                            </div>

                            {!canView && <div className="mt-3 text-sm text-red-600">You don’t have permission to view this page.</div>}
                        </CardContent>
                    </GlassCard>
                </div>
            </div>

            {/* Add Items dialog */}
            <AddItemDialog
                open={openAddItems}
                onOpenChange={setOpenAddItems}
                eligibleItems={eligibleItems}
                onAddItem={(id) => {
                    addItem(id)
                    // keep dialog open for fast multi-add
                }}
            />
        </div>
    )
}
