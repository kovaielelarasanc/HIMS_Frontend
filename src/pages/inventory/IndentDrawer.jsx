// FILE: src/pages/inventory/IndentDrawer.jsx
import { useCallback, useEffect, useMemo, useState } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

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

function toNumberOrEmpty(v) {
  const s = String(v ?? "").trim()
  if (!s) return ""
  const n = Number(s)
  return Number.isFinite(n) ? n : ""
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

  // cancel
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  const status = String(indent?.status || "")

  const canEditThis = canUpdate && status === "DRAFT"
  const canSubmitThis = canSubmit && status === "DRAFT"
  const canApproveThis = canApprove && status === "SUBMITTED"
  const canCancelThis =
    canCancel && !["ISSUED", "PARTIALLY_ISSUED", "CLOSED", "CANCELLED"].includes(status)
  const canCreateIssueThis =
    canCreateIssue && ["APPROVED", "PARTIALLY_ISSUED"].includes(status)

  const itemRows = useMemo(() => indent?.items || [], [indent])

  const resetLocal = useCallback(() => {
    setLoading(false)
    setIndent(null)
    setEditMode(false)
    setEdit({ priority: "", notes: "" })
    setApproveNotes("")
    setApproveMap({})
    setCancelOpen(false)
    setCancelReason("")
  }, [])

  const load = useCallback(async () => {
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
  }, [indentId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

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

  const handleOpenChange = (v) => {
    onOpenChange?.(v)
    if (!v) resetLocal()
  }

  const indentTitle =
    indent?.indent_number || (indentId ? `Indent #${indentId}` : "Indent")

  const fromName = indent?.from_location?.name || indent?.from_location_id || "-"
  const toName = indent?.to_location?.name || indent?.to_location_id || "-"

  return (
    <>
      {/* MAIN CENTER MODAL (Responsive) */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cx(
            "p-0 overflow-hidden",
            "w-[96vw] sm:w-[92vw] max-w-[920px]",
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
                      {indentTitle}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      From{" "}
                      <span className="font-medium text-foreground">{fromName}</span>{" "}
                      <ArrowRight className="inline w-3.5 h-3.5 mx-1 -mt-[2px]" />
                      To <span className="font-medium text-foreground">{toName}</span>
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
                  <div className="text-foreground font-medium">{fmtIST(indent?.created_at)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 border p-3">
                  <div>Indent Date</div>
                  <div className="text-foreground font-medium">
                    {indent?.indent_date ? fmtIST(indent.indent_date) : "-"}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {canEditThis ? (
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => setEditMode((v) => !v)}
                    disabled={loading}
                  >
                    <FileEdit className="w-4 h-4 mr-2" />
                    {editMode ? "Close Edit" : "Edit"}
                  </Button>
                ) : null}

                {canSubmitThis ? (
                  <Button className="rounded-2xl" onClick={doSubmit} disabled={loading}>
                    <ClipboardCheck className="w-4 h-4 mr-2" />
                    Submit
                  </Button>
                ) : null}

                {canApproveThis ? (
                  <Button className="rounded-2xl" onClick={doApprove} disabled={loading}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                ) : null}

                {canCreateIssueThis ? (
                  <Button className="rounded-2xl" onClick={doCreateIssue} disabled={loading}>
                    <Truck className="w-4 h-4 mr-2" />
                    Create Issue
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
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Body (scroll) */}
          <ScrollArea className="h-[calc(92vh-180px)] sm:h-[calc(88vh-180px)]">
            <div className="p-5 space-y-4">
              {!loading && !indent ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No data.</div>
              ) : null}

              {/* Edit */}
              {indent && editMode ? (
                <div className="rounded-3xl border bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold">Edit Indent (DRAFT only)</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <Label>Priority</Label>
                      <Input
                        value={edit.priority}
                        onChange={(e) => setEdit((p) => ({ ...p, priority: e.target.value }))}
                        placeholder="ROUTINE / STAT"
                        className="rounded-2xl"
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={edit.notes}
                        onChange={(e) => setEdit((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Add notes…"
                        className="rounded-2xl min-h-[84px]"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        setEditMode(false)
                        setEdit({
                          priority: indent?.priority || "ROUTINE",
                          notes: indent?.notes || "",
                        })
                      }}
                      disabled={loading}
                    >
                      Reset
                    </Button>
                    <Button className="rounded-2xl" onClick={doUpdate} disabled={loading}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Approve Panel */}
              {indent && canApproveThis ? (
                <div className="rounded-3xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Approval</div>
                      <div className="text-xs text-muted-foreground">
                        Adjust approved quantity per item (default = requested)
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="rounded-2xl w-full sm:w-auto"
                      onClick={approveAll}
                      disabled={loading}
                    >
                      Approve All
                    </Button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {itemRows.map((it) => {
                      const current = approveMap[it.id] ?? it.requested_qty ?? 0
                      return (
                        <div
                          key={it.id}
                          className="rounded-2xl border bg-slate-50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {it.item?.name || it.item_name || `Item #${it.item_id}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Requested: {it.requested_qty} • Issued: {it.issued_qty || 0}
                            </div>
                          </div>

                          <div className="w-full sm:w-[180px]">
                            <Label className="text-xs">Approved</Label>
                            <Input
                              inputMode="decimal"
                              value={current}
                              onChange={(e) => {
                                const next = toNumberOrEmpty(e.target.value)
                                setApproveMap((p) => ({ ...p, [it.id]: next === "" ? "" : next }))
                              }}
                              onBlur={() => {
                                // normalize empty to requested qty on blur (optional)
                                setApproveMap((p) => {
                                  const v = p[it.id]
                                  if (v === "" || v === null || v === undefined) {
                                    return { ...p, [it.id]: Number(it.requested_qty ?? 0) }
                                  }
                                  return p
                                })
                              }}
                              className="rounded-2xl"
                              disabled={loading}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-3 space-y-1">
                    <Label>Approval Notes (optional)</Label>
                    <Textarea
                      value={approveNotes}
                      onChange={(e) => setApproveNotes(e.target.value)}
                      className="rounded-2xl min-h-[84px]"
                      placeholder="Add any approval remarks…"
                      disabled={loading}
                    />
                  </div>
                </div>
              ) : null}

              {/* Items */}
              {indent ? (
                <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
                  <div className="p-4 border-b">
                    <div className="text-sm font-semibold">Indent Items</div>
                    <div className="text-xs text-muted-foreground">
                      Requested vs Approved vs Issued
                    </div>
                  </div>

                  <div className="divide-y">
                    {itemRows.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">No items.</div>
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
                              <Badge className="rounded-2xl bg-rose-100 text-rose-800">STAT</Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-2xl">
                                Routine
                              </Badge>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div className="rounded-2xl bg-slate-50 border p-3">
                              <div className="text-muted-foreground">Requested</div>
                              <div className="font-semibold">{it.requested_qty}</div>
                            </div>
                            <div className="rounded-2xl bg-slate-50 border p-3">
                              <div className="text-muted-foreground">Approved</div>
                              <div className="font-semibold">{it.approved_qty}</div>
                            </div>
                            <div className="rounded-2xl bg-slate-50 border p-3">
                              <div className="text-muted-foreground">Issued</div>
                              <div className="font-semibold">{it.issued_qty || 0}</div>
                            </div>
                          </div>
                        </div>
                      ))
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

      {/* Cancel Dialog (center modal) */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="w-[92vw] max-w-[520px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Cancel Indent</DialogTitle>
            <DialogDescription>Cancellation requires a reason (for audit).</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Reason *</Label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="rounded-2xl"
              placeholder="Example: Duplicate / Not required / Wrong location..."
              disabled={loading}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
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
              Cancel Indent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
