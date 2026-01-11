// FILE: src/pages/inventory/InventoryIndentsPage.jsx
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Plus, RefreshCcw, Search, Filter, ClipboardList, ArrowRight } from "lucide-react"

import { useCanFn } from "@/hooks/useCan"
import {
    invListIndents,
    invListLocations,
    invListItems,
    invCreateIndent,
} from "@/api/inventoryIndent"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import IndentDrawer from "./IndentDrawer"

const cx = (...a) => a.filter(Boolean).join(" ")

const PERMS = {
    INDENT_CREATE: ["inventory.indents.create", "inventory.indents.manage", "inv.indents.create", "inv.indents.manage"],
    INDENT_VIEW: ["inventory.indents.view", "inventory.indent.view", "inv.indents.view", "inv.indent.view"],
}

const fmtIST = (isoOrDate) => {
    if (!isoOrDate) return "-"
    try {
        const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
        return new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(d)
    } catch {
        return String(isoOrDate)
    }
}

const statusBadge = (s) => {
    const v = String(s || "").toUpperCase()
    const map = {
        DRAFT: "bg-slate-100 text-slate-700",
        SUBMITTED: "bg-amber-100 text-amber-800",
        APPROVED: "bg-emerald-100 text-emerald-800",
        PARTIALLY_ISSUED: "bg-indigo-100 text-indigo-800",
        ISSUED: "bg-blue-100 text-blue-800",
        CLOSED: "bg-slate-200 text-slate-800",
        CANCELLED: "bg-rose-100 text-rose-800",
    }
    return map[v] || "bg-slate-100 text-slate-700"
}

export default function InventoryIndentsPage() {
    const { canAny } = useCanFn()
    const canIndentView = canAny(PERMS.INDENT_VIEW)
    const canIndentCreate = canAny(PERMS.INDENT_CREATE)

    const [locations, setLocations] = useState([])
    const [items, setItems] = useState([])

    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [indentId, setIndentId] = useState(null)

    const [q, setQ] = useState("")
    const [filterOpen, setFilterOpen] = useState(false)
    const [filters, setFilters] = useState({
        status: "",
        from_location_id: "",
        to_location_id: "",
        date_from: "",
        date_to: "",
    })

    const [refetchKey, setRefetchKey] = useState(0)
    const bumpRefetch = () => setRefetchKey((k) => k + 1)

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false)
    const [createPayload, setCreatePayload] = useState({
        from_location_id: "",
        to_location_id: "",
        priority: "ROUTINE",
        notes: "",
        patient_id: "",
        visit_id: "",
        ipd_admission_id: "",
        encounter_type: "",
        encounter_id: "",
        items: [],
    })
    const [itemSearch, setItemSearch] = useState("")
    const [catalogLoading, setCatalogLoading] = useState(false)

    const filteredItems = useMemo(() => {
        const s = itemSearch.trim().toLowerCase()
        if (!s) return items.slice(0, 80)
        return items
            .filter((x) => String(x.name || "").toLowerCase().includes(s) || String(x.code || "").toLowerCase().includes(s))
            .slice(0, 120)
    }, [items, itemSearch])

    const loadCatalog = async () => {
        console.log("hello");

        try {
            setCatalogLoading(true)
            const [locs, its] = await Promise.all([
                invListLocations({ active: true }),
                invListItems({ is_active: true }), // ✅ do NOT send item_type=null
            ])
            console.log(locs, "check");

            setLocations(locs.data || [])
            setItems(its || [])
        } catch (e) {
            console.log(e, "check this");

            toast.error(e?.message || "Failed to load catalog")
        } finally {
            setCatalogLoading(false)
        }
    }

    const loadList = async () => {
        if (!canIndentView) return
        try {
            setLoading(true)
            const baseParams = {
                limit: 200,
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.from_location_id ? { from_location_id: Number(filters.from_location_id) } : {}),
                ...(filters.to_location_id ? { to_location_id: Number(filters.to_location_id) } : {}),
                ...(filters.date_from ? { date_from: filters.date_from } : {}),
                ...(filters.date_to ? { date_to: filters.date_to } : {}),
            }
            const all = await invListIndents(baseParams)
            const s = q.trim().toLowerCase()
            const final = !s ? all : (all || []).filter((r) => String(r.indent_number || "").toLowerCase().includes(s))
            setRows(final || [])
        } catch (e) {
            toast.error(e?.message || "Failed to load indents")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadCatalog()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        loadList()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchKey])

    const resetCreate = () => {
        setCreatePayload({
            from_location_id: "",
            to_location_id: "",
            priority: "ROUTINE",
            notes: "",
            patient_id: "",
            visit_id: "",
            ipd_admission_id: "",
            encounter_type: "",
            encounter_id: "",
            items: [],
        })
        setItemSearch("")
    }

    const addLine = (item) => {
        const exists = createPayload.items.some((x) => x.item_id === item.id)
        if (exists) return toast.message("Item already added")
        setCreatePayload((p) => ({
            ...p,
            items: [...p.items, { item_id: item.id, requested_qty: 1, is_stat: false, remarks: "" }],
        }))
    }

    const removeLine = (itemId) => {
        setCreatePayload((p) => ({ ...p, items: p.items.filter((x) => x.item_id !== itemId) }))
    }

    const updateLine = (itemId, patch) => {
        setCreatePayload((p) => ({
            ...p,
            items: p.items.map((x) => (x.item_id === itemId ? { ...x, ...patch } : x)),
        }))
    }

    const validateCreate = () => {
        const frm = Number(createPayload.from_location_id)
        const to = Number(createPayload.to_location_id)
        if (!frm || !to) return "Select From & To locations"
        if (frm === to) return "From and To cannot be same"
        if (!createPayload.items?.length) return "Add at least 1 item"
        for (const li of createPayload.items) {
            const q = Number(li.requested_qty)
            if (!Number.isFinite(q) || q <= 0) return "Requested Qty must be > 0"
        }
        return null
    }

    const doCreateIndent = async () => {
        const msg = validateCreate()
        if (msg) return toast.error(msg)

        try {
            const payload = {
                from_location_id: Number(createPayload.from_location_id),
                to_location_id: Number(createPayload.to_location_id),
                priority: createPayload.priority,
                notes: createPayload.notes || "",
                patient_id: createPayload.patient_id ? Number(createPayload.patient_id) : null,
                visit_id: createPayload.visit_id ? Number(createPayload.visit_id) : null,
                ipd_admission_id: createPayload.ipd_admission_id ? Number(createPayload.ipd_admission_id) : null,
                encounter_type: createPayload.encounter_type || null,
                encounter_id: createPayload.encounter_id ? Number(createPayload.encounter_id) : null,
                items: createPayload.items.map((x) => ({
                    item_id: Number(x.item_id),
                    requested_qty: Number(x.requested_qty),
                    is_stat: !!x.is_stat,
                    remarks: x.remarks || "",
                })),
            }

            const created = await invCreateIndent(payload)
            toast.success("Indent created")
            setCreateOpen(false)
            resetCreate()
            setIndentId(created?.id || null)
            bumpRefetch()
        } catch (e) {
            toast.error(e?.message || "Create failed")
        }
    }

    if (!canIndentView) {
        return <div className="p-6 text-sm text-muted-foreground">Not permitted.</div>
    }

    return (
        <div className="p-4 md:p-6 space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="text-2xl font-semibold tracking-tight">Consumable Indents</div>
                    <div className="text-sm text-muted-foreground">Ward/OT order placing — Indent → Submit</div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => bumpRefetch()}>
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>

                    {canIndentCreate ? (
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Indent
                        </Button>
                    ) : null}
                </div>
            </motion.div>

            <Card className="rounded-2xl shadow-sm border bg-white">
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-muted-foreground" />
                            <CardTitle className="text-base">Indents</CardTitle>
                            <CardDescription className="hidden md:block">Tap a row to open</CardDescription>
                        </div>

                        <div className="flex flex-col md:flex-row gap-2 md:items-center">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search indent number..." className="pl-9 rounded-xl w-full md:w-[320px]" />
                            </div>

                            <Button variant="outline" className="rounded-xl" onClick={() => setFilterOpen(true)}>
                                <Filter className="w-4 h-4 mr-2" />
                                Filters
                            </Button>

                            <Button className="rounded-xl" onClick={() => bumpRefetch()}>
                                Apply Search
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    {loading ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                                Loading...
                            </span>
                        </div>
                    ) : (rows || []).length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">No indents found.</div>
                    ) : (
                        <div className="grid gap-2">
                            {(rows || []).map((r) => (
                                <button
                                    key={r.id}
                                    className={cx("text-left w-full rounded-2xl border bg-white shadow-sm", "hover:shadow-md transition p-4")}
                                    onClick={() => setIndentId(r.id)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-semibold truncate">{r.indent_number || `Indent #${r.id}`}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Created: {fmtIST(r.created_at)} • Indent Date: {r.indent_date ? r.indent_date : "-"}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                From: {r.from_location?.name || r.from_location_id} <ArrowRight className="inline w-3 h-3 mx-1" /> To:{" "}
                                                {r.to_location?.name || r.to_location_id}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <Badge className={cx("rounded-xl", statusBadge(r.status))}>{String(r.status || "").replaceAll("_", " ")}</Badge>
                                            <Badge variant="outline" className="rounded-xl">
                                                {String(r.priority || "ROUTINE")}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="mt-3 text-xs text-muted-foreground">Items: {(r.items || []).length}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Filters */}
            <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
                <DialogContent className="max-w-[720px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Filters</DialogTitle>
                        <DialogDescription>Filter list by status, locations, and date range.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Status</Label>
                            <Input value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} placeholder="DRAFT / SUBMITTED / APPROVED..." className="rounded-xl" />
                        </div>

                        <div className="space-y-1">
                            <Label>From Location</Label>
                            <Select value={filters.from_location_id} onValueChange={(v) => setFilters((p) => ({ ...p, from_location_id: v }))}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All</SelectItem>
                                    {locations?.map((l) => (
                                        <SelectItem key={l.id} value={String(l.id)}>
                                            {l.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label>To Location</Label>
                            <Select value={filters.to_location_id} onValueChange={(v) => setFilters((p) => ({ ...p, to_location_id: v }))}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All</SelectItem>
                                    {(locations || []).map((l) => (
                                        <SelectItem key={l.id} value={String(l.id)}>
                                            {l.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label>Date From</Label>
                            <Input type="date" value={filters.date_from} onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))} className="rounded-xl" />
                        </div>

                        <div className="space-y-1">
                            <Label>Date To</Label>
                            <Input type="date" value={filters.date_to} onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))} className="rounded-xl" />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() =>
                                setFilters({
                                    status: "",
                                    from_location_id: "",
                                    to_location_id: "",
                                    date_from: "",
                                    date_to: "",
                                })
                            }
                        >
                            Reset
                        </Button>
                        <Button
                            className="rounded-xl"
                            onClick={() => {
                                setFilterOpen(false)
                                bumpRefetch()
                            }}
                        >
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Indent */}
            <Dialog
                open={createOpen}
                onOpenChange={(v) => {
                    setCreateOpen(v)
                    if (!v) resetCreate()
                }}
            >
                <DialogContent className="max-w-[980px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Create New Indent</DialogTitle>
                        <DialogDescription>Select locations, add items, set requested quantities.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Left */}
                        <div className="lg:col-span-1 space-y-3">
                            <div className="space-y-1">
                                <Label>From Location *</Label>
                                <Select value={createPayload.from_location_id} onValueChange={(v) => setCreatePayload((p) => ({ ...p, from_location_id: v }))}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder={catalogLoading ? "Loading..." : "Select"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(locations || [])?.map((l) => (
                                            <SelectItem key={l.id} value={String(l.id)}>
                                                {l.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>To Location *</Label>
                                <Select value={createPayload.to_location_id} onValueChange={(v) => setCreatePayload((p) => ({ ...p, to_location_id: v }))}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder={catalogLoading ? "Loading..." : "Select"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations?.map((l) => (
                                            <SelectItem key={l.id} value={String(l.id)}>
                                                {l.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Priority</Label>
                                <Select value={createPayload.priority} onValueChange={(v) => setCreatePayload((p) => ({ ...p, priority: v }))}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ROUTINE">ROUTINE</SelectItem>
                                        <SelectItem value="STAT">STAT</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Notes</Label>
                                <Input value={createPayload.notes} onChange={(e) => setCreatePayload((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional note..." className="rounded-xl" />
                            </div>
                        </div>

                        {/* Middle */}
                        <div className="lg:col-span-1 space-y-3">
                            <div className="space-y-1">
                                <Label>Add Items</Label>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search item name / code..." className="pl-9 rounded-xl" />
                                </div>
                            </div>

                            <div className="border rounded-2xl overflow-hidden bg-slate-50">
                                <div className="max-h-[420px] overflow-auto">
                                    {catalogLoading ? (
                                        <div className="p-4 text-sm text-muted-foreground">Loading items...</div>
                                    ) : filteredItems.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground">No items match.</div>
                                    ) : (
                                        <div className="divide-y">
                                            {filteredItems.map((it) => (
                                                <button key={it.id} className="w-full text-left p-3 hover:bg-white transition" onClick={() => addLine(it)} type="button">
                                                    <div className="font-medium truncate">{it.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {it.code} • {it.item_type}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right */}
                        <div className="lg:col-span-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-semibold">Selected Items</div>
                                    <div className="text-xs text-muted-foreground">Set qty + STAT if needed</div>
                                </div>
                                <Badge variant="outline" className="rounded-xl">
                                    {createPayload.items.length}
                                </Badge>
                            </div>

                            <div className="border rounded-2xl overflow-hidden">
                                <div className="max-h-[420px] overflow-auto">
                                    {createPayload.items.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground">No items added yet.</div>
                                    ) : (
                                        <div className="divide-y">
                                            {createPayload.items.map((li) => {
                                                const it = items.find((x) => x.id === li.item_id)
                                                return (
                                                    <div key={li.item_id} className="p-3 bg-white">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <div className="font-medium truncate">{it?.name || `Item #${li.item_id}`}</div>
                                                                <div className="text-xs text-muted-foreground">{it?.code || "-"}</div>
                                                            </div>

                                                            <Button variant="outline" className="rounded-xl" onClick={() => removeLine(li.item_id)} type="button">
                                                                Remove
                                                            </Button>
                                                        </div>

                                                        <div className="mt-3 grid grid-cols-2 gap-2 items-end">
                                                            <div className="space-y-1">
                                                                <Label>Requested Qty</Label>
                                                                <Input value={li.requested_qty} onChange={(e) => updateLine(li.item_id, { requested_qty: e.target.value })} className="rounded-xl" />
                                                            </div>

                                                            <div className="flex items-center justify-between border rounded-xl px-3 py-2">
                                                                <div className="text-sm font-medium">STAT</div>
                                                                <Switch checked={!!li.is_stat} onCheckedChange={(v) => updateLine(li.item_id, { is_stat: v })} />
                                                            </div>

                                                            <div className="col-span-2 space-y-1">
                                                                <Label>Remarks</Label>
                                                                <Input value={li.remarks} onChange={(e) => updateLine(li.item_id, { remarks: e.target.value })} placeholder="Optional" className="rounded-xl" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => { setCreateOpen(false); resetCreate() }}>
                            Close
                        </Button>
                        <Button className="rounded-xl" onClick={doCreateIndent}>
                            Create Indent
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Drawer */}
            <IndentDrawer
                open={!!indentId}
                indentId={indentId}
                onOpenChange={(v) => !v && setIndentId(null)}
                onOpenIssue={() => { /* Ward screen should NOT auto-open pharmacy issue screen */ }}
                onChanged={() => bumpRefetch()}
            />
        </div>
    )
}
