// FILE: src/components/quickOrders/WardPatientUsageTab.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
    Plus,
    RefreshCcw,
    Trash2,
    Search,
    Barcode,
    ClipboardList,
    Building2,
    AlertTriangle,
} from "lucide-react"

import { useCanFn } from "@/hooks/useCan"
import { invListLocations } from "@/api/inventoryIndent"
import {
    invListConsumptionItems,
    invCreatePatientConsumption,
    invListPatientConsumptions,
} from "@/api/inventoryConsumption"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatIST } from "@/ipd/components/timeZONE"

function cx(...x) {
    return x.filter(Boolean).join(" ")
}

function fmtIST(v) {
    if (!v) return "—"
    try {
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return String(v)
        return d.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return String(v)
    }
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

    useEffect(() => {
        if (!open) setQ("")
    }, [open])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Add consumables</DialogTitle>
                    <DialogDescription>Search and tap to add into this usage entry</DialogDescription>
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
                                    type="button"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">
                                                {it.name} <span className="text-xs text-slate-500">({it.code})</span>
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                Unit: {it.unit} · Stock: {it.on_hand_qty}
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="rounded-full shrink-0">
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
   Main Tab Component
------------------------- */
export default function WardPatientUsageTab({
    patient,
    ctx, // "opd" | "ipd"
    contextId, // visit_id / admission_id
    defaultLocationId,
}) {
    const { canAny } = useCanFn()
    const canCreate = canAny(["inventory.consume.create", "inventory.manage"])
    const canView = canAny(["inventory.consume.view", "inventory.manage", "inventory.view"])

    const patientId = patient?.id ? Number(patient.id) : null
    const encounterType = useMemo(() => {
        if (ctx === "ipd") return "IP"
        if (ctx === "opd") return "OP"
        return ctx ? String(ctx).toUpperCase() : ""
    }, [ctx])

    const encounterId = contextId ? Number(contextId) : null
    const canUseContext = !!(patientId && encounterType && encounterId)

    // masters
    const [locations, setLocations] = useState([])
    const [loadingLocations, setLoadingLocations] = useState(false)

    const locationMap = useMemo(() => {
        const m = new Map()
        for (const l of locations) m.set(l.id, l)
        return m
    }, [locations])

    // create form
    const [form, setForm] = useState({
        location_id: defaultLocationId ? String(defaultLocationId) : "",
        notes: "",
        items: [],
    })

    const [eligibleItems, setEligibleItems] = useState([])
    const [loadingEligible, setLoadingEligible] = useState(false)
    const [openAddItems, setOpenAddItems] = useState(false)

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

    // scan
    const [scanCode, setScanCode] = useState("")
    const scanRef = useRef(null)

    // recent list
    const [rows, setRows] = useState([])
    const [loadingList, setLoadingList] = useState(false)

    const [saving, setSaving] = useState(false)

    async function loadLocations() {
        try {
            setLoadingLocations(true)
            const res = await invListLocations({ is_active: true })
            const data = unwrapAny(res)
            setLocations(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e?.message || "Failed to load locations")
            setLocations([])
        } finally {
            setLoadingLocations(false)
        }
    }

    async function loadEligible() {
        const locId = Number(form.location_id)
        if (!locId) {
            setEligibleItems([])
            return
        }
        try {
            setLoadingEligible(true)
            const res = await invListConsumptionItems({ location_id: locId, limit: 250 })
            const data = unwrapAny(res)
            setEligibleItems(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e?.message || "Failed to load eligible items")
            setEligibleItems([])
        } finally {
            setLoadingEligible(false)
        }
    }

    async function loadList() {
        if (!canView || !canUseContext) return
        try {
            setLoadingList(true)
            const res = await invListPatientConsumptions({
                limit: 20,
                offset: 0,
                patient_id: patientId,
                encounter_type: encounterType,
                encounter_id: encounterId,
            })
            const data = unwrapAny(res)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e?.message || "Failed to load usage list")
            setRows([])
        } finally {
            setLoadingList(false)
        }
    }

    useEffect(() => {
        loadLocations()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        loadEligible()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.location_id])

    useEffect(() => {
        loadList()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canUseContext, canView, patientId, encounterType, encounterId])

    // if context changes, reset small things (but keep location if already set)
    useEffect(() => {
        setForm((s) => ({ ...s, notes: "", items: [] }))
        setScanCode("")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId, encounterType, encounterId])

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

    function validateCreate() {
        if (!canCreate) return "Not permitted"
        if (!canUseContext) return "Missing patient/encounter context"
        const location_id = Number(form.location_id)
        if (!location_id) return "Select Ward/OT location"
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
            patient_id: patientId,
            encounter_type: encounterType,
            encounter_id: encounterId,
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
            toast.success("Ward usage saved")

            setForm((s) => ({ ...s, notes: "", items: [] }))
            setScanCode("")
            await loadList()
        } catch (e) {
            toast.error(e?.message || "Failed to save usage")
        } finally {
            setSaving(false)
        }
    }

    const listCount = rows?.length || 0
    const selectedLoc = form.location_id ? locationMap.get(Number(form.location_id)) : null

    return (
        <div className="space-y-3">
            {/* Small header banner */}
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-2xl bg-gradient-to-b from-teal-600 to-teal-800 text-white flex items-center justify-center shadow-sm">
                            <ClipboardList className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-slate-900">Ward Patient Usage</div>
                            <div className="text-[11px] text-slate-600">
                                Consumables usage entry → auto-linked to <b>{encounterType}</b> / <b>{encounterId || "—"}</b> for billing.
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full text-[11px] bg-white/70">
                            Lines: {form.items?.length || 0}
                        </Badge>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-xl bg-white/70"
                            onClick={loadList}
                            disabled={!canView || !canUseContext || loadingList}
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {!canUseContext && (
                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <div>Missing patient/context. Open this tab from OPD/IPD visit screen with patient loaded.</div>
                    </div>
                )}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                {/* LEFT: Create */}
                <GlassCard className="h-fit">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base">Create usage entry</CardTitle>
                                <CardDescription className="mt-1">
                                    No filters — just select location, add items, save.
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
                            <Label className="text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                    <Building2 className="h-3.5 w-3.5" />
                                    Ward/OT Location
                                </span>
                            </Label>

                            <select
                                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-200"
                                value={form.location_id}
                                onChange={(e) => setForm((s) => ({ ...s, location_id: e.target.value }))}
                                disabled={!canCreate || loadingLocations}
                            >
                                <option value="">Select location</option>
                                {locations.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name} ({l.code})
                                    </option>
                                ))}
                            </select>

                            {selectedLoc && (
                                <div className="mt-1 text-[11px] text-slate-500">
                                    Selected: <span className="font-medium text-slate-700">{selectedLoc.name}</span>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div>
                            <Label className="text-xs text-slate-500">Notes (optional)</Label>
                            <Textarea
                                rows={2}
                                className="mt-1 resize-none rounded-xl bg-white/80 text-sm"
                                value={form.notes}
                                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                                placeholder="Optional nurse note / remarks"
                                disabled={!canCreate}
                            />
                        </div>

                        {/* Scan / code add */}
                        <div className="rounded-2xl border border-slate-200 bg-white/60 p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="font-medium">Add items fast</div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                        {loadingEligible ? "Loading eligible items..." : "Scan barcode or add from searchable list."}
                                    </div>
                                </div>

                                <Badge variant="outline" className="rounded-full text-[11px]">
                                    Eligible: {eligibleItems?.length || 0}
                                </Badge>
                            </div>

                            <div className="mt-3">
                                <Label className="text-xs text-slate-500">Scan / Enter Item Code</Label>
                                <div className="mt-1 flex gap-2">
                                    <Input
                                        ref={scanRef}
                                        className="h-10 rounded-xl bg-white"
                                        value={scanCode}
                                        onChange={(e) => setScanCode(e.target.value)}
                                        placeholder="Scan barcode or type item code"
                                        disabled={!canCreate || !form.location_id || loadingEligible}
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
                                        disabled={!canCreate || !scanCode}
                                        title="Add by code"
                                    >
                                        <Barcode className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                    Tip: barcode scanner usually types code + Enter.
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-xl bg-white"
                                    onClick={() => setOpenAddItems(true)}
                                    disabled={!canCreate || !form.location_id || loadingEligible}
                                >
                                    <Search className="mr-2 h-4 w-4" />
                                    Add items
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-xl bg-white"
                                    onClick={loadEligible}
                                    disabled={!form.location_id || loadingEligible}
                                >
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Reload eligible
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
                                                    type="button"
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
                                                                    items: s.items.map((i) => (i.item_id === x.item_id ? { ...i, qty: v } : i)),
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
                            <Button
                                variant="outline"
                                className="rounded-xl bg-white/70"
                                onClick={() => setForm((s) => ({ ...s, notes: "", items: [] }))}
                                disabled={saving}
                                type="button"
                            >
                                Clear
                            </Button>

                            <Button
                                className="ml-auto rounded-xl bg-gradient-to-b from-teal-600 to-teal-800"
                                onClick={submit}
                                disabled={saving || !canCreate || !canUseContext}
                                type="button"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                {saving ? "Saving..." : "Save Usage"}
                            </Button>
                        </div>

                        {!canCreate && <div className="text-sm text-red-600">You don’t have permission to add usage.</div>}
                    </CardContent>
                </GlassCard>

                {/* RIGHT: Recent list */}
                <GlassCard>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base">Recent usage (this encounter)</CardTitle>
                                <CardDescription className="mt-1">Audit-friendly list · no filters</CardDescription>
                            </div>
                            <Badge variant="secondary" className="rounded-full">
                                {listCount}
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                            <ScrollArea className="h-[440px]">
                                <div className="divide-y">
                                    {loadingList ? (
                                        <div className="p-6 text-sm text-slate-500">Loading...</div>
                                    ) : rows?.length ? (
                                        rows.map((r) => (
                                            <div key={r.consumption_id} className="p-4 hover:bg-slate-50/60 transition">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="font-medium truncate">
                                                            {r.consumption_number || `#${r.consumption_id}`}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500">{formatIST(r.posted_at)}</div>
                                                    </div>
                                                    <Badge variant="secondary" className="rounded-full shrink-0">
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
                                                        <div className="text-xs text-slate-500">Total Qty</div>
                                                        <div className="font-medium">{r.total_qty}</div>
                                                    </div>

                                                    <div className="rounded-xl bg-slate-50 p-2">
                                                        <div className="text-xs text-slate-500">Encounter</div>
                                                        <div className="font-medium">
                                                            {r.encounter_type && r.encounter_id ? `${r.encounter_type} • ${r.encounter_id}` : "—"}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-xl bg-slate-50 p-2">
                                                        <div className="text-xs text-slate-500">Patient</div>
                                                        <div className="font-medium">{r.patient_id ? `#${r.patient_id}` : "—"}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-6 text-center text-sm text-slate-500">No usage entries found</div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {!canView && (
                            <div className="mt-3 text-sm text-red-600">You don’t have permission to view usage list.</div>
                        )}
                    </CardContent>
                </GlassCard>
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
