import { useEffect, useMemo, useState, useCallback } from "react"
import { toast } from "sonner"
import { Plus, Search, RefreshCcw, Pencil, Trash2 } from "lucide-react"

import { useCanAny } from "../hooks/useCan"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"

import {
    listOtInstrumentMasters,
    createOtInstrumentMaster,
    updateOtInstrumentMaster,
    deleteOtInstrumentMaster,
} from "@/api/otMasters"

const emptyForm = {
    code: "",
    name: "",
    uom: "Nos",
    available_qty: 0,
    cost_per_qty: 0,
    description: "",
    is_active: true,
}

export default function InstrumentMastersPage() {
    const can = useCanAny()

    const canView = can("ot.masters.view") || can("ot.instruments.view")
    const canCreate = can("ot.masters.create") || can("ot.instruments.create")
    const canUpdate = can("ot.masters.update") || can("ot.instruments.update")
    const canDelete = can("ot.masters.delete") || can("ot.instruments.delete")

    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])

    const [q, setQ] = useState("")
    const [active, setActive] = useState("true") // "true" | "false" | "all"

    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState("create") // create | edit
    const [form, setForm] = useState(emptyForm)
    const [editId, setEditId] = useState(null)

    const activeParam = useMemo(() => {
        if (active === "all") return undefined
        return active === "true"
    }, [active])

    const fetchData = useCallback(async () => {
        if (!canView) return
        setLoading(true)
        try {
            const res = await listOtInstrumentMasters({
                q: q || undefined,
                active: activeParam,
                limit: 300,
            })
            setRows(res?.data || [])
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed to load instruments")
        } finally {
            setLoading(false)
        }
    }, [q, activeParam, canView])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const openCreate = () => {
        setMode("create")
        setEditId(null)
        setForm(emptyForm)
        setOpen(true)
    }

    const openEdit = (r) => {
        setMode("edit")
        setEditId(r.id)
        setForm({
            code: r.code || "",
            name: r.name || "",
            uom: r.uom || "Nos",
            available_qty: Number(r.available_qty || 0),
            cost_per_qty: Number(r.cost_per_qty || 0),
            description: r.description || "",
            is_active: Boolean(r.is_active),
        })
        setOpen(true)
    }

    const onSave = async () => {
        if (!form.code?.trim()) return toast.error("Code is required")
        if (!form.name?.trim()) return toast.error("Name is required")

        const payload = {
            ...form,
            code: form.code.trim(),
            name: form.name.trim(),
            uom: (form.uom || "Nos").trim(),
            available_qty: Number(form.available_qty || 0),
            cost_per_qty: Number(form.cost_per_qty || 0),
            description: form.description || "",
            is_active: Boolean(form.is_active),
        }

        try {
            if (mode === "create") {
                if (!canCreate) return toast.error("No permission to create")
                await createOtInstrumentMaster(payload)
                toast.success("Instrument created")
            } else {
                if (!canUpdate) return toast.error("No permission to update")
                await updateOtInstrumentMaster(editId, payload)
                toast.success("Instrument updated")
            }
            setOpen(false)
            fetchData()
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Save failed")
        }
    }

    const onDelete = async (r) => {
        if (!canDelete) return toast.error("No permission to delete")
        const ok = confirm(`Deactivate instrument "${r.name}"?`)
        if (!ok) return
        try {
            await deleteOtInstrumentMaster(r.id) // backend soft-deletes by is_active=false
            toast.success("Instrument deactivated")
            fetchData()
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Delete failed")
        }
    }

    if (!canView) {
        return (
            <div className="p-6">
                <Card className="rounded-2xl">
                    <CardContent className="p-6">
                        <div className="text-sm text-muted-foreground">
                            You don’t have permission to view Instrument Masters.
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-4">
            <Card className="rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-xl">Instrument Masters</CardTitle>
                        <div className="text-sm text-muted-foreground">
                            Add instruments once, use them in OT counts automatically.
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={fetchData}
                            disabled={loading}
                            className="rounded-xl"
                        >
                            <RefreshCcw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>

                        {canCreate && (
                            <Button onClick={openCreate} className="rounded-xl">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Instrument
                            </Button>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-7">
                            <Label className="text-xs">Search</Label>
                            <div className="relative">
                                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search by code or name..."
                                    className="pl-9 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-3">
                            <Label className="text-xs">Status</Label>
                            <Select value={active} onValueChange={setActive}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="true">Active</SelectItem>
                                    <SelectItem value="false">Inactive</SelectItem>
                                    <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="md:col-span-2 flex items-end">
                            <Button
                                className="w-full rounded-xl"
                                variant="secondary"
                                onClick={fetchData}
                                disabled={loading}
                            >
                                Apply
                            </Button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="rounded-2xl border overflow-hidden">
                        <div className="grid grid-cols-12 bg-muted/40 px-4 py-3 text-xs font-medium">
                            <div className="col-span-2">Code</div>
                            <div className="col-span-4">Name</div>
                            <div className="col-span-2">UOM</div>
                            <div className="col-span-2">Qty</div>
                            <div className="col-span-1">Status</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        {loading ? (
                            <div className="px-4 py-6 text-sm text-muted-foreground">
                                Loading...
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-muted-foreground">
                                No instruments found.
                            </div>
                        ) : (
                            rows.map((r) => (
                                <div
                                    key={r.id}
                                    className="grid grid-cols-12 px-4 py-3 border-t items-center hover:bg-muted/20"
                                >
                                    <div className="col-span-2 text-sm font-medium">{r.code}</div>
                                    <div className="col-span-4">
                                        <div className="text-sm font-medium">{r.name}</div>
                                        {r.description ? (
                                            <div className="text-xs text-muted-foreground line-clamp-1">
                                                {r.description}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="col-span-2 text-sm">{r.uom || "Nos"}</div>
                                    <div className="col-span-2 text-sm">
                                        {Number(r.available_qty || 0)}
                                    </div>
                                    <div className="col-span-1">
                                        {r.is_active ? (
                                            <Badge variant="secondary">Active</Badge>
                                        ) : (
                                            <Badge variant="outline">Inactive</Badge>
                                        )}
                                    </div>
                                    <div className="col-span-1 flex justify-end gap-2">
                                        {canUpdate && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="rounded-xl"
                                                onClick={() => openEdit(r)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="rounded-xl"
                                                onClick={() => onDelete(r)}
                                                disabled={!r.is_active}
                                                title={!r.is_active ? "Already inactive" : "Deactivate"}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {mode === "create" ? "Add Instrument" : "Edit Instrument"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Code *</Label>
                            <Input
                                value={form.code}
                                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                                className="rounded-xl"
                                placeholder="Eg: INST-001"
                            />
                        </div>

                        <div>
                            <Label className="text-xs">UOM</Label>
                            <Input
                                value={form.uom}
                                onChange={(e) => setForm((p) => ({ ...p, uom: e.target.value }))}
                                className="rounded-xl"
                                placeholder="Nos"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <Label className="text-xs">Name *</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                className="rounded-xl"
                                placeholder="Eg: Artery Forceps"
                            />
                        </div>

                        <div>
                            <Label className="text-xs">Available Qty</Label>
                            <Input
                                type="number"
                                value={form.available_qty}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, available_qty: e.target.value }))
                                }
                                className="rounded-xl"
                            />
                        </div>

                        <div>
                            <Label className="text-xs">Cost / Qty</Label>
                            <Input
                                type="number"
                                value={form.cost_per_qty}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, cost_per_qty: e.target.value }))
                                }
                                className="rounded-xl"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <Label className="text-xs">Description</Label>
                            <Input
                                value={form.description}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, description: e.target.value }))
                                }
                                className="rounded-xl"
                                placeholder="Optional notes..."
                            />
                        </div>

                        <div className="md:col-span-2">
                            <Label className="text-xs">Status</Label>
                            <Select
                                value={form.is_active ? "true" : "false"}
                                onValueChange={(v) =>
                                    setForm((p) => ({ ...p, is_active: v === "true" }))
                                }
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="true">Active</SelectItem>
                                    <SelectItem value="false">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="rounded-xl" onClick={onSave}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
