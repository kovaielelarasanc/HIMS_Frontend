import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, RefreshCw, Trash2, Search } from "lucide-react"

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
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"

function fmtDateTime(dt) {
    if (!dt) return "-"
    const d = new Date(dt)
    return d.toLocaleString()
}

function cx(...x) {
    return x.filter(Boolean).join(" ")
}

/** Minimal patient picker (search + select). If your system already has a patient selector, replace this. */
function PatientPicker({ value, onChange }) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState("")
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])

    async function search() {
        try {
            setLoading(true)
            const data = await listPatients({ q, limit: 20 })
            console.log(data, "check");

            setRows(Array.isArray(data?.data) ? data?.data : [])
        } catch (e) {
            toast.error(e?.message || "Failed to search patients")
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!open) return
        // load initial
        search()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const selectedLabel = value ? `Patient ID: ${value}` : "Select patient"

    return (
        <>
            <div className="flex gap-2">
                <Input
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value ? e.target.value : null)}
                    placeholder="Patient ID (type or pick)"
                    className="h-10 rounded-xl"
                // inputMode="numeric"
                />
                <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setOpen(true)}>
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

                    <div className="mt-3 max-h-[360px] overflow-auto rounded-2xl border bg-white">
                        {rows?.length ? (
                            <div className="divide-y">
                                {rows.map((p) => (
                                    <button
                                        key={p.id}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-50"
                                        onClick={() => {
                                            onChange(p.id)
                                            setOpen(false)
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-medium">{p.first_name || p.name || `Patient #${p.id}`}</div>
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

                    <DialogFooter>
                        <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                        <div className="text-xs text-slate-500">{selectedLabel}</div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default function WardPatientUsagePage() {
    const { canAny } = useCanFn()

    const canView = canAny(["inventory.consume.view", "inventory.manage", "inventory.view"])
    const canCreate = canAny(["inventory.consume.create", "inventory.manage"])

    const [locations, setLocations] = useState([])
    const [loadingLocations, setLoadingLocations] = useState(false)

    const [filters, setFilters] = useState({
        location_id: "",
        patient_id: "",
        date_from: "",
        date_to: "",
    })

    const [rows, setRows] = useState([])
    const [loadingList, setLoadingList] = useState(false)

    // Create drawer
    const [openCreate, setOpenCreate] = useState(false)
    const [form, setForm] = useState({
        location_id: "",
        patient_id: null,
        notes: "",
        items: [],
    })
    const [eligibleItems, setEligibleItems] = useState([])
    const [loadingEligible, setLoadingEligible] = useState(false)
    const [saving, setSaving] = useState(false)

    async function loadLocations() {
        try {
            setLoadingLocations(true)
            const data = await invListLocations({ is_active: true })
            setLocations(Array.isArray(data?.data) ? data?.data : [])
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
                ...(filters.date_from ? { date_from: filters.date_from } : {}),
                ...(filters.date_to ? { date_to: filters.date_to } : {}),
            }
            const data = await invListPatientConsumptions(params)
            setRows(Array.isArray(data?.data) ? data?.data : [])
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
            const data = await invListConsumptionItems({
                location_id: locId,
                patient_id: patId, // ✅ makes backend return only “issued for this patient” items (your rule)
                limit: 200,
            })
            console.log(data, "12345678909rtyuio");

            setEligibleItems(Array.isArray(data?.data) ? data?.data : [])
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
        if (!openCreate) return
        loadEligible()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openCreate, form.location_id, form.patient_id])

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

    async function submit() {
        if (!canCreate) return toast.error("Not permitted")

        const location_id = Number(form.location_id)
        const patient_id = form.patient_id ? Number(form.patient_id) : null

        if (!location_id) return toast.error("Select Ward/OT location")
        if (!patient_id) return toast.error("Select patient")
        if (!form.items?.length) return toast.error("Add at least 1 item")

        const payload = {
            location_id,
            patient_id,
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
            setOpenCreate(false)
            setForm({ location_id: "", patient_id: null, notes: "", items: [] })
            await loadList()
        } catch (e) {
            toast.error(e?.message || "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <Card className="rounded-2xl border-slate-200 bg-gradient-to-br from-slate-50 to-white">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                        <CardTitle className="text-xl">Ward Patient Usage</CardTitle>
                        <CardDescription>
                            Nurse entry: select patient + items used (only issued/available items will show)
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={loadList}
                            disabled={loadingList || !canView}
                            title={!canView ? "No permission" : "Refresh"}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                        <Button
                            className="rounded-xl"
                            onClick={() => {
                                if (!canCreate) return toast.error("Not permitted")
                                setOpenCreate(true)
                            }}
                            disabled={!canCreate}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Usage
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                        <div className="md:col-span-2">
                            <Label className="text-xs text-slate-500">Ward/OT Location</Label>
                            <select
                                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
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

                        <div>
                            <Label className="text-xs text-slate-500">Patient ID</Label>
                            <Input
                                className="mt-1 h-10 rounded-xl"
                                value={filters.patient_id}
                                onChange={(e) => setFilters((s) => ({ ...s, patient_id: e.target.value }))}
                                placeholder="e.g. 123"
                            />
                        </div>

                        <div>
                            <Label className="text-xs text-slate-500">From</Label>
                            <Input
                                type="date"
                                className="mt-1 h-10 rounded-xl"
                                value={filters.date_from}
                                onChange={(e) => setFilters((s) => ({ ...s, date_from: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-slate-500">To</Label>
                            <Input
                                type="date"
                                className="mt-1 h-10 rounded-xl"
                                value={filters.date_to}
                                onChange={(e) => setFilters((s) => ({ ...s, date_to: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                        <Button className="rounded-xl" onClick={loadList} disabled={!canView || loadingList}>
                            Apply
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => {
                                setFilters({ location_id: "", patient_id: "", date_from: "", date_to: "" })
                                setTimeout(loadList, 0)
                            }}
                        >
                            Clear
                        </Button>
                    </div>

                    {/* Table */}
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Date/Time</th>
                                    <th className="px-4 py-3 text-left font-medium">Doc</th>
                                    <th className="px-4 py-3 text-left font-medium">Location</th>
                                    <th className="px-4 py-3 text-left font-medium">Patient</th>
                                    <th className="px-4 py-3 text-right font-medium">Lines</th>
                                    <th className="px-4 py-3 text-right font-medium">Total Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loadingList ? (
                                    <tr>
                                        <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                                            Loading...
                                        </td>
                                    </tr>
                                ) : rows?.length ? (
                                    rows.map((r) => (
                                        <tr key={r.consumption_id} className="hover:bg-slate-50/60">
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
                                            <td className="px-4 py-3 text-right">{r.total_lines}</td>
                                            <td className="px-4 py-3 text-right">{r.total_qty}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                                            No usage entries found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!canView && (
                        <div className="mt-3 text-sm text-red-600">
                            You don’t have permission to view this page.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Usage Sheet */}
            <Sheet open={openCreate} onOpenChange={setOpenCreate}>
                <SheetContent side="right" className="w-full max-w-2xl rounded-l-2xl">
                    <SheetHeader>
                        <SheetTitle>Add Patient Usage</SheetTitle>
                        <SheetDescription>
                            Select patient + items used. Items list shows only “issued/available” items for that patient in this location.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-4 space-y-4">
                        <div>
                            <Label>Ward/OT Location</Label>
                            <select
                                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                value={form.location_id}
                                onChange={(e) => setForm((s) => ({ ...s, location_id: e.target.value }))}
                            >
                                <option value="">Select location</option>
                                {locations.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name} ({l.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label>Patient</Label>
                            <div className="mt-1">
                                <PatientPicker
                                    value={form.patient_id}
                                    onChange={(id) => setForm((s) => ({ ...s, patient_id: id }))}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Notes</Label>
                            <Input
                                className="mt-1 h-10 rounded-xl"
                                value={form.notes}
                                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                                placeholder="Optional notes"
                            />
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <div className="font-medium">Items Used</div>
                                    <div className="text-xs text-slate-500">
                                        {loadingEligible
                                            ? "Loading eligible items..."
                                            : "Only eligible items are shown based on patient + location"}
                                    </div>
                                </div>

                                <select
                                    className={cx(
                                        "h-10 rounded-xl border bg-white px-3 text-sm",
                                        "border-slate-200"
                                    )}
                                    value=""
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (!val) return
                                        addItem(Number(val))
                                    }}
                                    disabled={!form.location_id || !form.patient_id || loadingEligible}
                                >
                                    <option value="">
                                        {!form.location_id || !form.patient_id
                                            ? "Select location + patient"
                                            : eligibleItems?.length
                                                ? "Add item..."
                                                : "No eligible items"}
                                    </option>
                                    {eligibleItems.map((it) => (
                                        <option key={it.item_id} value={it.item_id}>
                                            {it.name} ({it.code}) — Stock: {it.on_hand_qty}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mt-3 space-y-2">
                                {form.items?.length ? (
                                    form.items.map((x) => (
                                        <div
                                            key={x.item_id}
                                            className="rounded-2xl border border-slate-200 bg-white p-3"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-medium">
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
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>

                                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                                <div>
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
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
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
                                                    />
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
                    </div>

                    <SheetFooter className="mt-4">
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setOpenCreate(false)}
                        >
                            Cancel
                        </Button>
                        <Button className="rounded-xl" onClick={submit} disabled={saving}>
                            {saving ? "Saving..." : "Save Usage"}
                        </Button>
                    </SheetFooter>

                    {!canCreate && (
                        <div className="mt-3 text-sm text-red-600">
                            You don’t have permission to add usage.
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
