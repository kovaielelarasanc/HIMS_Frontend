// FILE: src/pages/inventory/IssueDrawer.jsx
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, XCircle, Save, ArrowRight } from "lucide-react"

import { useCanFn } from "@/hooks/useCan"
import {
  invGetIssue,
  invUpdateIssueItem,
  invPostIssue,
  invCancelIssue,
  invListBatches,
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

const cx = (...a) => a.filter(Boolean).join(" ")

// ✅ IMPORTANT: sentinel value (Radix SelectItem cannot be empty string)
const AUTO_FEFO = "__AUTO_FEFO__"

const PERMS = {
  ISSUE_UPDATE: [
    "inventory.issues.update",
    "inventory.issues.manage",
    "inv.issues.update",
    "inv.issues.manage",
  ],
  ISSUE_POST: [
    "inventory.issues.post",
    "inventory.issues.manage",
    "inv.issues.post",
    "inv.issues.manage",
  ],
  ISSUE_CANCEL: [
    "inventory.issues.cancel",
    "inventory.issues.manage",
    "inv.issues.cancel",
    "inv.issues.manage",
  ],
  BATCH_VIEW: [
    "inventory.batches.view",
    "inventory.stock.view",
    "inv.batches.view",
    "inv.stock.view",
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
    POSTED: "bg-emerald-100 text-emerald-800",
    CANCELLED: "bg-rose-100 text-rose-800",
  }
  return map[v] || "bg-slate-100 text-slate-700"
}

export default function IssueDrawer({ open, onOpenChange, issueId, onChanged }) {
  const { canAny } = useCanFn()
  const canUpdate = canAny(PERMS.ISSUE_UPDATE)
  const canPost = canAny(PERMS.ISSUE_POST)
  const canCancel = canAny(PERMS.ISSUE_CANCEL)
  const canBatchView = canAny(PERMS.BATCH_VIEW)

  const [loading, setLoading] = useState(false)
  const [issue, setIssue] = useState(null)

  const [dirty, setDirty] = useState({}) // issue_item_id -> patch
  const [batchesCache, setBatchesCache] = useState({}) // key: `${fromLoc}-${itemId}` -> batches[]

  const status = String(issue?.status || "")
  const canEditLines = canUpdate && status === "DRAFT"
  const canPostThis = canPost && status === "DRAFT"
  const canCancelThis = canCancel && status !== "CANCELLED"

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  const lines = issue?.items || []

  const load = async () => {
    if (!issueId) return
    try {
      setLoading(true)
      const data = await invGetIssue(issueId)
      setIssue(data)
      setDirty({})
    } catch (e) {
      toast.error(e?.message || "Failed to load issue")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, issueId])

  const updateDirty = (lineId, patch) => {
    setDirty((p) => ({
      ...p,
      [lineId]: { ...(p[lineId] || {}), ...patch },
    }))
  }

  const getBatches = async (fromLocId, itemId) => {
    const key = `${fromLocId}-${itemId}`
    if (batchesCache[key]) return batchesCache[key]
    if (!canBatchView) return []
    try {
      const rows = await invListBatches({
        location_id: Number(fromLocId),
        item_id: Number(itemId),
        only_available: true,
      })
      setBatchesCache((p) => ({ ...p, [key]: rows || [] }))
      return rows || []
    } catch (e) {
      toast.error(e?.message || "Failed to load batches")
      return []
    }
  }

  const doSaveAll = async () => {
    const ids = Object.keys(dirty || {})
    if (!ids.length) return toast.message("No changes to save")

    try {
      setLoading(true)

      for (const id of ids) {
        const patch = dirty[id]

        const issued_qty =
          patch.issued_qty !== undefined ? Number(patch.issued_qty) : undefined
        if (issued_qty !== undefined && (!Number.isFinite(issued_qty) || issued_qty <= 0)) {
          throw new Error("Issued qty must be > 0")
        }

        // batch_id: allow null (Auto FEFO)
        const batch_id =
          patch.batch_id !== undefined
            ? patch.batch_id === null
              ? null
              : Number(patch.batch_id)
            : undefined

        if (batch_id !== undefined && batch_id !== null && !Number.isFinite(batch_id)) {
          throw new Error("Invalid batch selection")
        }

        await invUpdateIssueItem(Number(id), {
          ...(patch.issued_qty !== undefined ? { issued_qty } : {}),
          ...(patch.batch_id !== undefined ? { batch_id } : {}),
          ...(patch.remarks !== undefined ? { remarks: patch.remarks || "" } : {}),
        })
      }

      toast.success("Saved changes")
      await load()
      onChanged?.()
    } catch (e) {
      toast.error(e?.message || "Save failed")
    } finally {
      setLoading(false)
    }
  }

  const doPost = async () => {
    if (Object.keys(dirty || {}).length) {
      const proceed = confirm("You have unsaved changes. Save before posting?")
      if (proceed) await doSaveAll()
    }

    try {
      setLoading(true)
      await invPostIssue(issueId)
      toast.success("Issue posted")
      await load()
      onChanged?.()
    } catch (e) {
      toast.error(e?.message || "Post failed")
    } finally {
      setLoading(false)
    }
  }

  const doCancel = async () => {
    const reason = cancelReason.trim()
    if (!reason) return toast.error("Cancel reason is required")

    try {
      setLoading(true)
      await invCancelIssue(issueId, { reason })
      toast.success("Issue cancelled")
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[820px] p-0">
          <div className="p-5 border-b bg-white">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xl font-semibold truncate">
                    {issue?.issue_number || (issueId ? `Issue #${issueId}` : "Issue")}
                  </div>
                  <SheetDescription className="mt-1">
                    From{" "}
                    <span className="font-medium text-foreground">
                      {issue?.from_location?.name || issue?.from_location_id || "-"}
                    </span>{" "}
                    <ArrowRight className="inline w-3 h-3 mx-1" />
                    To{" "}
                    <span className="font-medium text-foreground">
                      {issue?.to_location?.name || issue?.to_location_id || "-"}
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
                <div className="text-foreground font-medium">{fmtIST(issue?.created_at)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 border p-3">
                <div>Issue Date</div>
                <div className="text-foreground font-medium">
                  {issue?.issue_date ? fmtIST(issue.issue_date) : "-"}
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
            ) : !issue ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No data.</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {canEditLines ? (
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={doSaveAll}
                      disabled={!Object.keys(dirty || {}).length}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  ) : null}

                  {canPostThis ? (
                    <Button className="rounded-xl" onClick={doPost}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Post Issue
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

                <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                  <div className="p-4 border-b">
                    <div className="text-sm font-semibold">Issue Items</div>
                    <div className="text-xs text-muted-foreground">
                      Select batch (optional) and set issued qty
                    </div>
                  </div>

                  <div className="divide-y">
                    {lines.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">No items.</div>
                    ) : (
                      lines.map((li) => {
                        const patch = dirty[li.id] || {}

                        const issuedQty =
                          patch.issued_qty !== undefined ? patch.issued_qty : li.issued_qty

                        const batchId =
                          patch.batch_id !== undefined ? patch.batch_id : li.batch_id

                        const remarks =
                          patch.remarks !== undefined ? patch.remarks : (li.remarks || "")

                        return (
                          <IssueLine
                            key={li.id}
                            li={li}
                            canEdit={canEditLines}
                            issuedQty={issuedQty}
                            batchId={batchId}
                            remarks={remarks}
                            onChange={(p) => updateDirty(li.id, p)}
                            loadBatches={getBatches}
                            fromLocationId={issue.from_location_id}
                          />
                        )
                      })
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

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-[520px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Cancel Issue</DialogTitle>
            <DialogDescription>
              Cancellation requires a reason (audit + stock reversal rules).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label>Reason *</Label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="rounded-xl"
              placeholder="Example: Wrong batch / Mistake / Not required..."
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setCancelOpen(false)}>
              Close
            </Button>
            <Button
              className="rounded-xl border-rose-200 bg-rose-600 hover:bg-rose-700"
              onClick={doCancel}
            >
              Cancel Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function IssueLine({
  li,
  canEdit,
  issuedQty,
  batchId,
  remarks,
  onChange,
  loadBatches,
  fromLocationId,
}) {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(false)

  const itemName = li.item?.name || li.item_name || `Item #${li.item_id}`
  const itemCode = li.item?.code || li.item_code || ""

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!fromLocationId || !li.item_id) return
      setLoading(true)
      const rows = await loadBatches(fromLocationId, li.item_id)
      if (mounted) setBatches(rows || [])
      setLoading(false)
    }
    run()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLocationId, li.item_id])

  const selectValue = batchId ? String(batchId) : AUTO_FEFO

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{itemName}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {itemCode ? `${itemCode} • ` : ""}
            Line ID: {li.id}
          </div>
        </div>

        <Badge variant="outline" className="rounded-xl">
          Qty: {li.issued_qty}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Issued Qty</Label>
          <Input
            type="number"
            min="0"
            step="0.001"
            value={issuedQty ?? ""}
            onChange={(e) => onChange({ issued_qty: e.target.value })}
            className="rounded-xl"
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1">
          <Label>Batch (optional)</Label>
          <Select
            value={selectValue}
            onValueChange={(v) =>
              onChange({ batch_id: v === AUTO_FEFO ? null : v })
            }
            disabled={!canEdit}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder={loading ? "Loading..." : "Auto FEFO"} />
            </SelectTrigger>

            <SelectContent>
              {/* ✅ cannot be empty string */}
              <SelectItem value={AUTO_FEFO}>Auto FEFO</SelectItem>

              {(batches || []).map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {(b.batch_no || b.batch_number || `Batch#${b.id}`)} • Qty{" "}
                  {b.current_qty ?? b.qty ?? 0}
                  {b.expiry_date ? ` • Exp ${String(b.expiry_date)}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-[11px] text-muted-foreground">
            {loading
              ? "Loading batches..."
              : "Pick batch if required. Otherwise FEFO will apply."}
          </div>
        </div>

        <div className="space-y-1 md:col-span-3">
          <Label>Remarks</Label>
          <Input
            value={remarks}
            onChange={(e) => onChange({ remarks: e.target.value })}
            className="rounded-xl"
            disabled={!canEdit}
            placeholder="Optional remarks..."
          />
        </div>
      </div>
    </div>
  )
}
