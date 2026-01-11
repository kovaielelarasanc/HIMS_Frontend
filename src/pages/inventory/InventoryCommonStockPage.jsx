import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, RefreshCw, Sparkles, Search, ClipboardCheck } from "lucide-react"

import { useCanFn } from "@/hooks/useCan"
import { invListLocations } from "@/api/inventoryIndent"
import { invListConsumptionItems, invPostBulkReconcile } from "@/api/inventoryConsumption"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

function cx(...x) {
  return x.filter(Boolean).join(" ")
}

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

function fmtDate(dt) {
  if (!dt) return ""
  return new Date(dt).toISOString().slice(0, 10)
}

/* -------------------------
   Add Recon Items Dialog
------------------------- */
function AddReconItemDialog({ open, onOpenChange, eligible, onAdd }) {
  const [q, setQ] = useState("")
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return eligible
    return eligible.filter((it) => {
      const name = String(it?.name || "").toLowerCase()
      const code = String(it?.code || "").toLowerCase()
      return name.includes(s) || code.includes(s)
    })
  }, [eligible, q])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add items to reconcile</DialogTitle>
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
                  onClick={() => onAdd(it.item_id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {it.name} <span className="text-xs text-slate-500">({it.code})</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Stock: {it.on_hand_qty} · Unit: {it.unit}</div>
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

export default function InventoryCommonStockPage() {
  const { canAny } = useCanFn()

  const canReconcile = canAny(["inventory.reconcile.create", "inventory.manage"])
  const canView = canAny(["inventory.view", "inventory.manage"])

  const [locations, setLocations] = useState([])
  const [loadingLocations, setLoadingLocations] = useState(false)

  const [openRecon, setOpenRecon] = useState(false)
  const [saving, setSaving] = useState(false)

  const [recon, setRecon] = useState({
    location_id: "",
    on_date: fmtDate(new Date()),
    notes: "",
    lines: [],
  })

  const [eligible, setEligible] = useState([])
  const [loadingEligible, setLoadingEligible] = useState(false)

  const [resultOpen, setResultOpen] = useState(false)
  const [result, setResult] = useState(null)

  const [openAdd, setOpenAdd] = useState(false)

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

  async function loadEligibleItems(location_id) {
    if (!location_id) {
      setEligible([])
      return
    }
    try {
      setLoadingEligible(true)
      const res = await invListConsumptionItems({
        location_id: Number(location_id),
        limit: 400,
      })
      const data = unwrapAny(res)
      setEligible(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(e?.message || "Failed to load items")
      setEligible([])
    } finally {
      setLoadingEligible(false)
    }
  }

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    if (!openRecon) return
    if (!recon.location_id) return
    loadEligibleItems(recon.location_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRecon, recon.location_id])

  const eligibleMap = useMemo(() => {
    const m = new Map()
    for (const it of eligible) m.set(it.item_id, it)
    return m
  }, [eligible])

  function addReconItem(item_id) {
    if (!item_id) return
    const exists = recon.lines.some((x) => x.item_id === item_id)
    if (exists) return toast.message("Already added")

    const info = eligibleMap.get(item_id)
    setRecon((s) => ({
      ...s,
      lines: [
        ...s.lines,
        {
          item_id,
          closing_qty: info?.on_hand_qty ?? 0,
          remark: "",
          _name: info?.name || "",
          _code: info?.code || "",
          _unit: info?.unit || "unit",
          _before: info?.on_hand_qty ?? null,
        },
      ],
    }))
  }

  function removeReconItem(item_id) {
    setRecon((s) => ({ ...s, lines: s.lines.filter((x) => x.item_id !== item_id) }))
  }

  async function autofillFromCurrent() {
    if (!recon.location_id) return toast.error("Select location first")
    await loadEligibleItems(recon.location_id)
    setRecon((s) => ({
      ...s,
      lines: eligible.map((it) => ({
        item_id: it.item_id,
        closing_qty: it.on_hand_qty ?? 0,
        remark: "",
        _name: it.name,
        _code: it.code,
        _unit: it.unit,
        _before: it.on_hand_qty,
      })),
    }))
    toast.success("Loaded current stock as closing qty (edit what you counted)")
  }

  async function submitReconcile() {
    if (!canReconcile) return toast.error("Not permitted")

    const location_id = Number(recon.location_id)
    if (!location_id) return toast.error("Select location")
    if (!recon.lines?.length) return toast.error("Add at least 1 item")
    if (!recon.on_date) return toast.error("Select date")

    const payload = {
      location_id,
      on_date: recon.on_date,
      notes: recon.notes || "",
      lines: recon.lines.map((x) => ({
        item_id: x.item_id,
        closing_qty: Number(x.closing_qty),
        remark: x.remark || "",
      })),
    }

    try {
      setSaving(true)
      const res = await invPostBulkReconcile(payload)
      const data = unwrapAny(res)
      toast.success("Reconciled successfully")
      setResult(data)
      setResultOpen(true)
      setOpenRecon(false)
      setRecon({
        location_id: "",
        on_date: fmtDate(new Date()),
        notes: "",
        lines: [],
      })
    } catch (e) {
      toast.error(e?.message || "Failed to reconcile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-[1400px] p-4 md:p-6 space-y-4">
        <GlassCard className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-xl md:text-2xl">Common Stock</CardTitle>
              <CardDescription>
                Bulk reconcile (cotton/gauze packs) + other non-patient controls
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-xl bg-white/70"
                onClick={loadLocations}
                disabled={loadingLocations || !canView}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>

              <Button
                className="rounded-xl"
                onClick={() => {
                  if (!canReconcile) return toast.error("Not permitted")
                  setOpenRecon(true)
                }}
                disabled={!canReconcile}
              >
                <Plus className="mr-2 h-4 w-4" />
                Bulk Reconcile
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="reconcile">
              <TabsList className="rounded-xl">
                <TabsTrigger value="reconcile" className="rounded-xl">
                  Bulk Reconcile
                </TabsTrigger>
                <TabsTrigger value="returns" className="rounded-xl">
                  Returns / Wastage
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reconcile" className="mt-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">Closing Balance Reconcile</div>
                      <div className="mt-1 text-sm text-slate-500">
                        Enter closing qty (packs/rolls). System auto-consumes difference.
                      </div>
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      No new tables
                    </Badge>
                  </div>

                  <div className="mt-3 text-sm text-slate-600">
                    Click <b>Bulk Reconcile</b> to open the reconciliation sheet.
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="returns" className="mt-4">
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
                  <div className="flex items-center gap-2 font-medium">
                    <Sparkles className="h-4 w-4" />
                    Returns / Wastage screen
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Plug your returns/wastage APIs here (I can build list + drawer same premium style).
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </GlassCard>

        {/* Reconcile Sheet */}
        <Sheet open={openRecon} onOpenChange={setOpenRecon}>
          <SheetContent side="right" className="w-full max-w-2xl rounded-l-2xl">
            <SheetHeader>
              <SheetTitle>Bulk Reconcile</SheetTitle>
              <SheetDescription>Choose location + enter closing qty (bulk items like cotton rolls)</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-xs text-slate-500">Location</Label>
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={recon.location_id}
                  onChange={(e) => setRecon((s) => ({ ...s, location_id: e.target.value }))}
                  disabled={loadingLocations}
                >
                  <option value="">Select location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-slate-500">Date</Label>
                  <Input
                    type="date"
                    className="mt-1 h-10 rounded-xl"
                    value={recon.on_date}
                    onChange={(e) => setRecon((s) => ({ ...s, on_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Notes</Label>
                  <Input
                    className="mt-1 h-10 rounded-xl"
                    value={recon.notes}
                    onChange={(e) => setRecon((s) => ({ ...s, notes: e.target.value }))}
                    placeholder="Optional notes"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">Reconcile Lines</div>
                    <div className="text-xs text-slate-500">{loadingEligible ? "Loading items..." : "Add items and set closing qty"}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl bg-white"
                      onClick={autofillFromCurrent}
                      disabled={!recon.location_id || loadingEligible}
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Load current stock
                    </Button>

                    <Button
                      variant="outline"
                      className="rounded-xl bg-white"
                      onClick={() => setOpenAdd(true)}
                      disabled={!recon.location_id || loadingEligible}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Add items
                    </Button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {recon.lines?.length ? (
                    recon.lines.map((x) => (
                      <div key={x.item_id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {x._name || `Item #${x.item_id}`}{" "}
                              <span className="text-xs text-slate-500">({x._code})</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              Before: {x._before ?? "—"} · Unit: {x._unit}
                            </div>
                          </div>

                          <Button variant="outline" className="h-9 rounded-xl" onClick={() => removeReconItem(x.item_id)}>
                            Remove
                          </Button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div>
                            <Label className="text-xs text-slate-500">Closing Qty</Label>
                            <Input
                              className="mt-1 h-10 rounded-xl"
                              type="number"
                              min="0"
                              step="1"
                              value={x.closing_qty}
                              onChange={(e) => {
                                const v = e.target.value
                                setRecon((s) => ({
                                  ...s,
                                  lines: s.lines.map((i) => (i.item_id === x.item_id ? { ...i, closing_qty: v } : i)),
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
                                setRecon((s) => ({
                                  ...s,
                                  lines: s.lines.map((i) => (i.item_id === x.item_id ? { ...i, remark: v } : i)),
                                }))
                              }}
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                      Add items to reconcile
                    </div>
                  )}
                </div>
              </div>
            </div>

            <SheetFooter className="mt-4">
              <Button variant="outline" className="rounded-xl" onClick={() => setOpenRecon(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl" onClick={submitReconcile} disabled={saving}>
                {saving ? "Posting..." : "Post Reconcile"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Add items dialog */}
        <AddReconItemDialog
          open={openAdd}
          onOpenChange={setOpenAdd}
          eligible={eligible}
          onAdd={(id) => addReconItem(id)}
        />

        {/* Result Summary */}
        <Dialog open={resultOpen} onOpenChange={setResultOpen}>
          <DialogContent className="max-w-3xl rounded-2xl">
            <DialogHeader>
              <DialogTitle>Reconcile Result</DialogTitle>
              <DialogDescription>Auto-consumed / Adjusted quantities</DialogDescription>
            </DialogHeader>

            {/* Desktop table */}
            <div className="hidden md:block max-h-[420px] overflow-auto rounded-2xl border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-right font-medium">Before</th>
                    <th className="px-4 py-3 text-right font-medium">Closing</th>
                    <th className="px-4 py-3 text-right font-medium">Auto Consumed</th>
                    <th className="px-4 py-3 text-right font-medium">Adjusted In</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result?.lines?.length ? (
                    result.lines.map((l) => (
                      <tr key={l.item_id}>
                        <td className="px-4 py-3">Item #{l.item_id}</td>
                        <td className="px-4 py-3 text-right">{l.before_qty}</td>
                        <td className="px-4 py-3 text-right">{l.closing_qty}</td>
                        <td className="px-4 py-3 text-right">{l.auto_consumed_qty}</td>
                        <td className="px-4 py-3 text-right">{l.adjusted_in_qty}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                        No lines
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden max-h-[520px] overflow-auto space-y-3">
              {result?.lines?.length ? (
                result.lines.map((l) => (
                  <div key={l.item_id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">Item #{l.item_id}</div>
                      <Badge variant="secondary" className="rounded-full">
                        Closing: {l.closing_qty}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-xs text-slate-500">Before</div>
                        <div className="font-medium">{l.before_qty}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-xs text-slate-500">Auto Consumed</div>
                        <div className="font-medium">{l.auto_consumed_qty}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2 col-span-2">
                        <div className="text-xs text-slate-500">Adjusted In</div>
                        <div className="font-medium">{l.adjusted_in_qty}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  No lines
                </div>
              )}
            </div>

            <DialogFooter>
              <Button className="rounded-xl" onClick={() => setResultOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
