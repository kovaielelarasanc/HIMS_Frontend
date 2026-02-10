// FILE: src/pages/inventory/IssueDrawer.jsx
import { useCallback, useEffect, useMemo, useState } from "react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

const cx = (...a) => a.filter(Boolean).join(" ")

// ✅ IMPORTANT: sentinel value (Radix SelectItem cannot be empty string)
const AUTO_FEFO = "__AUTO_FEFO__"

const PERMS = {
  ISSUE_UPDATE: [
    "inventory.issues.update",
  ],
  ISSUE_POST: [
    "inventory.issues.post",
  ],
  ISSUE_CANCEL: [
    "inventory.issues.cancel",
  ],
  BATCH_VIEW: [
    "inventory.batches.view",
    "inventory.stock.view",
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

function safeNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
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

  const issueTitle = issue?.issue_number || (issueId ? `Issue #${issueId}` : "Issue")
  const fromName = issue?.from_location?.name || issue?.from_location_id || "-"
  const toName = issue?.to_location?.name || issue?.to_location_id || "-"

  const lines = useMemo(() => issue?.items || [], [issue])

  const resetLocal = useCallback(() => {
    setLoading(false)
    setIssue(null)
    setDirty({})
    setCancelOpen(false)
    setCancelReason("")
    // Keep cache (perf) — do not reset batchesCache
  }, [])

  const load = useCallback(async () => {
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
  }, [issueId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const updateDirty = (lineId, patch) => {
    setDirty((p) => ({
      ...p,
      [lineId]: { ...(p[lineId] || {}), ...patch },
    }))
  }

  const getBatches = useCallback(
    async (fromLocId, itemId) => {
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
    },
    [batchesCache, canBatchView]
  )

  const doSaveAll = async () => {
    const ids = Object.keys(dirty || {})
    if (!ids.length) return toast.message("No changes to save")

    try {
      setLoading(true)

      for (const id of ids) {
        const patch = dirty[id] || {}

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
      const proceed = window.confirm("You have unsaved changes. Save before posting?")
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

  const handleOpenChange = (v) => {
    onOpenChange?.(v)
    if (!v) resetLocal()
  }

  const hasDirty = !!Object.keys(dirty || {}).length

  return (
    <>
      {/* ✅ MAIN CENTER MODAL (Responsive) */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cx(
            "p-0 overflow-hidden",
            "w-[96vw] sm:w-[92vw] max-w-[980px]",
            "h-[92vh] sm:h-[88vh]",
            "rounded-3xl"
          )}
        >
          {/* Header (sticky) */}
          <div className="border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
            <div className="p-5">
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="text-xl font-semibold truncate">
                      {issueTitle}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      From <span className="font-medium text-foreground">{fromName}</span>{" "}
                      <ArrowRight className="inline w-3.5 h-3.5 mx-1 -mt-[2px]" /> To{" "}
                      <span className="font-medium text-foreground">{toName}</span>
                    </DialogDescription>
                  </div>

                  <Badge className={cx("rounded-2xl px-3 py-1.5", statusBadge(status))}>
                    {status ? status.replaceAll("_", " ") : "—"}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-2xl bg-slate-50 border p-3">
                  <div>Created</div>
                  <div className="text-foreground font-medium">{fmtIST(issue?.created_at)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 border p-3">
                  <div>Issue Date</div>
                  <div className="text-foreground font-medium">
                    {issue?.issue_date ? fmtIST(issue.issue_date) : "-"}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {canEditLines ? (
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={doSaveAll}
                    disabled={!hasDirty || loading}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                ) : null}

                {canPostThis ? (
                  <Button className="rounded-2xl" onClick={doPost} disabled={loading}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Post Issue
                  </Button>
                ) : null}

                {canCancelThis ? (
                  <Button
                    variant="outline"
                    className="rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={() => setCancelOpen(true)}
                    disabled={loading}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                ) : null}

                <div className="ml-auto text-xs text-muted-foreground">
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                      Loading…
                    </span>
                  ) : hasDirty ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Unsaved changes
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Body (scroll) */}
          <ScrollArea className="h-[calc(92vh-190px)] sm:h-[calc(88vh-190px)]">
            <div className="p-5 space-y-4">
              {!loading && !issue ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No data.</div>
              ) : null}

              {/* Items */}
              {issue ? (
                <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
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
                            canEdit={canEditLines && !loading}
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
              ) : null}
            </div>
          </ScrollArea>

          {/* Footer (sticky) */}
          <div className="border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="outline"
                className="rounded-2xl w-full sm:w-auto"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel modal (center) */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="w-[92vw] max-w-[520px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Cancel Issue</DialogTitle>
            <DialogDescription>
              Cancellation requires a reason (audit + stock reversal rules).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="rounded-2xl min-h-[90px]"
              placeholder="Example: Wrong batch / Mistake / Not required..."
              disabled={loading}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => setCancelOpen(false)}
              disabled={loading}
            >
              Close
            </Button>
            <Button
              className="rounded-2xl border-rose-200 bg-rose-600 hover:bg-rose-700"
              onClick={doCancel}
              disabled={loading}
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

  // ✅ Always give Select a non-empty value:
  // - If batchId exists -> String(batchId)
  // - Else -> AUTO_FEFO sentinel
  const selectValue = batchId ? String(batchId) : AUTO_FEFO

  const issuedLabel = useMemo(() => {
    const n = safeNum(issuedQty)
    return n === null ? "-" : n
  }, [issuedQty])

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

        <Badge variant="outline" className="rounded-2xl">
          Qty: {issuedLabel}
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
            className="rounded-2xl"
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1">
          <Label>Batch (optional)</Label>
          <Select
            value={selectValue}
            onValueChange={(v) => onChange({ batch_id: v === AUTO_FEFO ? null : v })}
            disabled={!canEdit}
          >
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder={loading ? "Loading..." : "Auto FEFO"} />
            </SelectTrigger>

            <SelectContent>
              {/* ✅ Radix: SelectItem value MUST NOT be empty string */}
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
            {loading ? "Loading batches..." : "Pick batch if required. Otherwise FEFO will apply."}
          </div>
        </div>

        <div className="space-y-1 md:col-span-3">
          <Label>Remarks</Label>
          <Input
            value={remarks}
            onChange={(e) => onChange({ remarks: e.target.value })}
            className="rounded-2xl"
            disabled={!canEdit}
            placeholder="Optional remarks..."
          />
        </div>
      </div>
    </div>
  )
}
