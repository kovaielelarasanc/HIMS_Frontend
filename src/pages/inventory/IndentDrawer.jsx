// FILE: src/pages/inventory/IndentDrawer.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
    CheckCircle2,
    ClipboardCheck,
    XCircle,
    FileEdit,
    Truck,
    ArrowRight,
} from "lucide-react"

import { useCanFn } from "@/hooks/useCan"
import {
    invGetIndent,
    invUpdateIndent,
    invSubmitIndent,
    invApproveIndent,
    invCancelIndent,
    invCreateIssueFromIndent,
} from "@/api/inventoryIndent"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

const cx = (...a) => a.filter(Boolean).join(" ")

const PERMS = {
    INDENT_UPDATE: [
        "inventory.indents.update",
        "inventory.indents.manage",
        "inv.indents.update",
        "inv.indents.manage",
    ],
    INDENT_SUBMIT: [
        "inventory.indents.submit",
        "inventory.indents.manage",
        "inv.indents.submit",
        "inv.indents.manage",
    ],
    INDENT_APPROVE: [
        "inventory.indents.approve",
        "inventory.indents.manage",
        "inv.indents.approve",
        "inv.indents.manage",
    ],
    INDENT_CANCEL: [
        "inventory.indents.cancel",
        "inventory.indents.manage",
        "inv.indents.cancel",
        "inv.indents.manage",
    ],
    ISSUE_CREATE: [
        "inventory.issues.create",
        "inventory.issues.manage",
        "inv.issues.create",
        "inv.issues.manage",
    ],
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

export default function IndentDrawer({
    open,
    onOpenChange,
    indentId,
    onChanged,
    onOpenIssue,
}) {
    const { canAny } = useCanFn()

    const canUpdate = canAny(PERMS.INDENT_UPDATE)
    const canSubmit = canAny(PERMS.INDENT_SUBMIT)
    const canApprove = canAny(PERMS.INDENT_APPROVE)
    const canCancel = canAny(PERMS.INDENT_CANCEL)
    const canCreateIssue = canAny(PERMS.ISSUE_CREATE)

    const [loading, setLoading] = useState(false)
    const [indent, setIndent] = useState(null)

    const [editMode, setEditMode] = useState(false)
    const [edit, setEdit] = useState({ priority: "", notes: "" })

    // approve
    const [approveNotes, setApproveNotes] = useState("")
    const [approveMap, setApproveMap] = useState({})
    const [cancelOpen, setCancelOpen] = useState(false)
    const [cancelReason, setCancelReason] = useState("")

    const status = String(indent?.status || "")

    const canEditThis =
        canUpdate && status === "DRAFT"
    const canSubmitThis =
        canSubmit && status === "DRAFT"
    const canApproveThis =
        canApprove && status === "SUBMITTED"
    const canCancelThis =
        canCancel && !["ISSUED", "PARTIALLY_ISSUED", "CLOSED", "CANCELLED"].includes(status)
    const canCreateIssueThis =
        canCreateIssue && ["APPROVED", "PARTIALLY_ISSUED"].includes(status)

    const load = async () => {
        if (!indentId) return
        try {
            setLoading(true)
            const data = await invGetIndent(indentId)
            setIndent(data)
            setEditMode(false)
            setEdit({ priority: data?.priority || "ROUTINE", notes: data?.notes || "" })
            setApproveNotes("")
            const map = {}
            for (const it of data?.items || []) {
                map[it.id] = Number(it.requested_qty ?? 0)
            }
            setApproveMap(map)
        } catch (e) {
            toast.error(e?.message || "Failed to load indent")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, indentId])

    const itemRows = indent?.items || []

    const approveAll = () => {
        const map = {}
        for (const it of itemRows) map[it.id] = Number(it.requested_qty ?? 0)
        setApproveMap(map)
    }

    const doUpdate = async () => {
        try {
            setLoading(true)
            await invUpdateIndent(indentId, {
                priority: edit.priority || "ROUTINE",
                notes: edit.notes || "",
            })
            toast.success("Indent updated")
            setEditMode(false)
            await load()
            onChanged?.()
        } catch (e) {
            toast.error(e?.message || "Update failed")
        } finally {
            setLoading(false)
        }
    }

    const doSubmit = async () => {
        try {
            setLoading(true)
            await invSubmitIndent(indentId)
            toast.success("Indent submitted")
            await load()
            onChanged?.()
        } catch (e) {
            toast.error(e?.message || "Submit failed")
        } finally {
            setLoading(false)
        }
    }

    const doApprove = async () => {
        try {
            setLoading(true)
            const items = itemRows.map((it) => ({
                indent_item_id: it.id,
                approved_qty: Number(approveMap[it.id] ?? it.requested_qty ?? 0),
            }))
            await invApproveIndent(indentId, {
                notes: approveNotes || "",
                items,
            })
            toast.success("Indent approved")
            await load()
            onChanged?.()
        } catch (e) {
            toast.error(e?.message || "Approve failed")
        } finally {
            setLoading(false)
        }
    }

    const doCancel = async () => {
        const reason = cancelReason.trim()
        if (!reason) return toast.error("Cancel reason is required")
        try {
            setLoading(true)
            await invCancelIndent(indentId, { reason })
            toast.success("Indent cancelled")
            setCancelOpen(false)
            setCancelReason("")
            await load()
            onChanged?.()
        } catch (e) {
            toast.error(e?.message || "Cancel failed")
        } finally {
            setLoading(false)
        }
    }

    const doCreateIssue = async () => {
        try {
            setLoading(true)
            const issue = await invCreateIssueFromIndent(indentId, { notes: "" })
            toast.success("Issue created")
            await load()
            onChanged?.()
            if (issue?.id) onOpenIssue?.(issue.id)
        } catch (e) {
            toast.error(e?.message || "Create issue failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:max-w-[720px] p-0">
                    <div className="p-5 border-b bg-white">
                        <SheetHeader>
                            <SheetTitle className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-xl font-semibold truncate">
                                        {indent?.indent_number || (indentId ? `Indent #${indentId}` : "Indent")}
                                    </div>
                                    <SheetDescription className="mt-1">
                                        From{" "}
                                        <span className="font-medium text-foreground">
                                            {indent?.from_location?.name || indent?.from_location_id || "-"}
                                        </span>{" "}
                                        <ArrowRight className="inline w-3 h-3 mx-1" />
                                        To{" "}
                                        <span className="font-medium text-foreground">
                                            {indent?.to_location?.name || indent?.to_location_id || "-"}
                                        </span>
                                    </SheetDescription>
                                </div>

                                <Badge className={cx("rounded-xl", statusBadge(status))}>
                                    {status.replaceAll("_", " ") || "—"}
                                </Badge>
                            </SheetTitle>
                        </SheetHeader>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div className="rounded-xl bg-slate-50 border p-3">
                                <div>Created</div>
                                <div className="text-foreground font-medium">
                                    {fmtIST(indent?.created_at)}
                                </div>
                            </div>
                            <div className="rounded-xl bg-slate-50 border p-3">
                                <div>Indent Date</div>
                                <div className="text-foreground font-medium">
                                    {indent?.indent_date ? fmtIST(indent.indent_date) : "-"}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 space-y-4">
                        {loading ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                                    Loading...
                                </span>
                            </div>
                        ) : !indent ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">
                                No data.
                            </div>
                        ) : (
                            <>
                                {/* Actions */}
                                <div className="flex flex-wrap gap-2">
                                    {canEditThis ? (
                                        <Button
                                            variant="outline"
                                            className="rounded-xl"
                                            onClick={() => setEditMode((v) => !v)}
                                        >
                                            <FileEdit className="w-4 h-4 mr-2" />
                                            {editMode ? "Close Edit" : "Edit"}
                                        </Button>
                                    ) : null}

                                    {canSubmitThis ? (
                                        <Button className="rounded-xl" onClick={doSubmit}>
                                            <ClipboardCheck className="w-4 h-4 mr-2" />
                                            Submit
                                        </Button>
                                    ) : null}

                                    {canApproveThis ? (
                                        <Button className="rounded-xl" onClick={doApprove}>
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Approve
                                        </Button>
                                    ) : null}

                                    {canCreateIssueThis ? (
                                        <Button className="rounded-xl" onClick={doCreateIssue}>
                                            <Truck className="w-4 h-4 mr-2" />
                                            Create Issue
                                        </Button>
                                    ) : null}

                                    {canCancelThis ? (
                                        <Button
                                            variant="outline"
                                            className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                                            onClick={() => setCancelOpen(true)}
                                        >
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Cancel
                                        </Button>
                                    ) : null}
                                </div>

                                {/* Edit */}
                                {editMode ? (
                                    <div className="rounded-2xl border bg-white p-4 shadow-sm">
                                        <div className="text-sm font-semibold">Edit Indent (DRAFT only)</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                            <div className="space-y-1">
                                                <Label>Priority</Label>
                                                <Input
                                                    value={edit.priority}
                                                    onChange={(e) =>
                                                        setEdit((p) => ({ ...p, priority: e.target.value }))
                                                    }
                                                    placeholder="ROUTINE / STAT"
                                                    className="rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-1 md:col-span-2">
                                                <Label>Notes</Label>
                                                <Input
                                                    value={edit.notes}
                                                    onChange={(e) =>
                                                        setEdit((p) => ({ ...p, notes: e.target.value }))
                                                    }
                                                    placeholder="Notes"
                                                    className="rounded-xl"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                className="rounded-xl"
                                                onClick={() => {
                                                    setEditMode(false)
                                                    setEdit({ priority: indent.priority || "ROUTINE", notes: indent.notes || "" })
                                                }}
                                            >
                                                Reset
                                            </Button>
                                            <Button className="rounded-xl" onClick={doUpdate}>
                                                Save Changes
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}

                                {/* Approve Panel */}
                                {canApproveThis ? (
                                    <div className="rounded-2xl border bg-white p-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-semibold">Approval</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Adjust approved quantity per item (default = requested)
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="rounded-xl"
                                                onClick={approveAll}
                                            >
                                                Approve All
                                            </Button>
                                        </div>

                                        <div className="mt-3 space-y-2">
                                            {itemRows.map((it) => (
                                                <div
                                                    key={it.id}
                                                    className="rounded-xl border bg-slate-50 p-3 flex items-center justify-between gap-2"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="font-medium truncate">
                                                            {it.item?.name || it.item_name || `Item #${it.item_id}`}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Requested: {it.requested_qty} • Issued: {it.issued_qty || 0}
                                                        </div>
                                                    </div>

                                                    <div className="w-[140px]">
                                                        <Label className="text-xs">Approved</Label>
                                                        <Input
                                                            value={approveMap[it.id] ?? it.requested_qty ?? 0}
                                                            onChange={(e) =>
                                                                setApproveMap((p) => ({
                                                                    ...p,
                                                                    [it.id]: e.target.value,
                                                                }))
                                                            }
                                                            className="rounded-xl"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-3 space-y-1">
                                            <Label>Approval Notes (optional)</Label>
                                            <Input
                                                value={approveNotes}
                                                onChange={(e) => setApproveNotes(e.target.value)}
                                                className="rounded-xl"
                                                placeholder="Add any approval remarks..."
                                            />
                                        </div>
                                    </div>
                                ) : null}

                                {/* Items */}
                                <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                                    <div className="p-4 border-b">
                                        <div className="text-sm font-semibold">Indent Items</div>
                                        <div className="text-xs text-muted-foreground">
                                            Requested vs Approved vs Issued
                                        </div>
                                    </div>

                                    <div className="divide-y">
                                        {itemRows.length === 0 ? (
                                            <div className="p-4 text-sm text-muted-foreground">
                                                No items.
                                            </div>
                                        ) : (
                                            itemRows.map((it) => (
                                                <div key={it.id} className="p-4">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="font-medium truncate">
                                                                {it.item?.name || it.item_name || `Item #${it.item_id}`}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                Remarks: {it.remarks || "-"}
                                                            </div>
                                                        </div>
                                                        {it.is_stat ? (
                                                            <Badge className="rounded-xl bg-rose-100 text-rose-800">
                                                                STAT
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="rounded-xl">
                                                                Routine
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                                        <div className="rounded-xl bg-slate-50 border p-3">
                                                            <div className="text-muted-foreground">Requested</div>
                                                            <div className="font-semibold">{it.requested_qty}</div>
                                                        </div>
                                                        <div className="rounded-xl bg-slate-50 border p-3">
                                                            <div className="text-muted-foreground">Approved</div>
                                                            <div className="font-semibold">{it.approved_qty}</div>
                                                        </div>
                                                        <div className="rounded-xl bg-slate-50 border p-3">
                                                            <div className="text-muted-foreground">Issued</div>
                                                            <div className="font-semibold">{it.issued_qty || 0}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <SheetFooter className="p-5 border-t bg-white">
                        <Button
                            variant="outline"
                            className="rounded-xl w-full"
                            onClick={() => onOpenChange(false)}
                        >
                            Close
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Cancel Dialog */}
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent className="max-w-[520px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Cancel Indent</DialogTitle>
                        <DialogDescription>
                            Cancellation requires a reason (for audit).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1">
                        <Label>Reason *</Label>
                        <Input
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="rounded-xl"
                            placeholder="Example: Duplicate / Not required / Wrong location..."
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setCancelOpen(false)}
                        >
                            Close
                        </Button>
                        <Button
                            className="rounded-xl border-rose-200 bg-rose-600 hover:bg-rose-700"
                            onClick={doCancel}
                        >
                            Cancel Indent
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
