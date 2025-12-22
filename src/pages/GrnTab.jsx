// FILE: src/pages/pharmacy/GrnTab.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Plus,
  RefreshCcw,
  Search,
  Link2,
  ArrowRight,
  SplitSquareVertical,
  Trash2,
  AlertTriangle,
  PackageOpen,
  ClipboardList,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

import {
  listGrns,
  createGrn,
  updateGrn,
  getGrn,
  postGrn,
  listPendingPos,
  getPoPendingItems,
  listSuppliers,
  listLocations,
  listInventoryItems,
} from "@/api/inventory"

// ---------------- utils ----------------
const n = (v) => {
  if (v === "" || v === null || v === undefined) return 0
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const round2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100
const money = (x) => round2(x).toFixed(2)
const todayISO = () => new Date().toISOString().slice(0, 10)

const formatDate = (d) => {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleDateString()
  } catch {
    return String(d)
  }
}

const errText = (e, fallback = "Something went wrong") => {
  const d = e?.response?.data?.detail
  if (!d) return fallback
  if (typeof d === "string") return d
  if (Array.isArray(d)) {
    return d
      .map((x) => x?.msg || x?.message || x?.detail || JSON.stringify(x))
      .slice(0, 3)
      .join(", ")
  }
  return JSON.stringify(d)
}

const uuid = () => {
  try {
    return crypto.randomUUID()
  } catch {
    return `ln_${Date.now()}_${Math.random().toString(16).slice(2)}`
  }
}

const emptyForm = () => ({
  po_id: "",
  supplier_id: "",
  location_id: "",
  received_date: todayISO(),
  invoice_number: "",
  invoice_date: "",
  supplier_invoice_amount: "",
  freight_amount: "",
  other_charges: "",
  round_off: "",
  notes: "",
  difference_reason: "",
})

const toStr = (v) => (v === null || v === undefined ? "" : String(v))

// normalize ANY inventory item shape to safe { id:number, name:string, ... }
const normalizeItem = (raw) => {
  const id =
    raw?.id ??
    raw?.item_id ??
    raw?.itemId ??
    raw?.item?.id ??
    raw?.item?.item_id ??
    null

  const name =
    raw?.name ??
    raw?.item_name ??
    raw?.label ??
    raw?.item?.name ??
    raw?.item?.item_name ??
    ""

  const code = raw?.code ?? raw?.item_code ?? raw?.item?.code ?? ""
  const generic_name =
    raw?.generic_name ??
    raw?.genericName ??
    raw?.item?.generic_name ??
    raw?.item?.genericName ??
    ""

  const default_price =
    raw?.default_price ??
    raw?.defaultPrice ??
    raw?.unit_cost ??
    raw?.price ??
    raw?.item?.default_price ??
    raw?.item?.unit_cost ??
    0

  const default_mrp =
    raw?.default_mrp ??
    raw?.defaultMrp ??
    raw?.mrp ??
    raw?.item?.default_mrp ??
    raw?.item?.mrp ??
    0

  const default_tax_percent =
    raw?.default_tax_percent ??
    raw?.defaultTaxPercent ??
    raw?.tax_percent ??
    raw?.gst_percent ??
    raw?.item?.default_tax_percent ??
    raw?.item?.tax_percent ??
    0

  // optional pack hints if your item master has these fields
  const strips_per_pack =
    raw?.strips_per_pack ??
    raw?.stripsPerPack ??
    raw?.pack_strips ??
    raw?.item?.strips_per_pack ??
    raw?.item?.stripsPerPack ??
    raw?.item?.pack_strips ??
    ""

  const tablets_per_strip =
    raw?.tablets_per_strip ??
    raw?.tabletsPerStrip ??
    raw?.strip_tablets ??
    raw?.item?.tablets_per_strip ??
    raw?.item?.tabletsPerStrip ??
    raw?.item?.strip_tablets ??
    ""

  return {
    ...raw,
    id: id ? Number(id) : null,
    name,
    code,
    generic_name,
    default_price,
    default_mrp,
    default_tax_percent,
    strips_per_pack,
    tablets_per_strip,
  }
}

const resolvePoItemId = (it) => {
  const id = it?.item_id ?? it?.itemId ?? it?.item?.id ?? it?.id ?? null
  return id ? Number(id) : null
}

const makeLine = (partial = {}) => ({
  _key: uuid(),
  po_item_id: null,

  item_id: null,
  item_name: "",

  // batch
  batch_no: "",
  expiry_date: "",

  // qty & pricing (stored to backend as FINAL per-tablet values)
  quantity: "",
  free_quantity: "",
  unit_cost: "", // per tablet
  mrp: "", // per tablet

  // NEW: Pack configuration (frontend-only; used to compute qty/unit_cost/mrp)
  packs: "",
  strips_per_pack: "",
  tablets_per_strip: "",
  pack_cost: "", // per pack
  pack_mrp: "", // per pack

  // discounts/tax/scheme
  discount_percent: "",
  discount_amount: "",
  cgst_percent: "",
  sgst_percent: "",
  igst_percent: "",
  tax_percent: "",
  scheme: "",
  remarks: "",

  ...partial,
})

/* ---------------- pack calculations (frontend-only) ---------------- */
const calcPack = (ln) => {
  const packs = n(ln.packs)
  const spp = n(ln.strips_per_pack)
  const tps = n(ln.tablets_per_strip)
  const packCost = n(ln.pack_cost)
  const packMrp = n(ln.pack_mrp)

  const hasAny =
    packs > 0 || spp > 0 || tps > 0 || packCost > 0 || packMrp > 0

  const isConfigured = packs > 0 && spp > 0 && tps > 0
  const isPartial = hasAny && !isConfigured

  const totalStrips = isConfigured ? round2(packs * spp) : 0
  const totalTabs = isConfigured ? round2(packs * spp * tps) : 0
  const denom = spp > 0 && tps > 0 ? spp * tps : 0

  const perStripCost = spp > 0 && packCost > 0 ? round2(packCost / spp) : 0
  const perStripMrp = spp > 0 && packMrp > 0 ? round2(packMrp / spp) : 0

  const perTabCost = denom > 0 && packCost > 0 ? round2(packCost / denom) : 0
  const perTabMrp = denom > 0 && packMrp > 0 ? round2(packMrp / denom) : 0

  return {
    packs,
    spp,
    tps,
    packCost,
    packMrp,
    hasAny,
    isConfigured,
    isPartial,
    totalStrips,
    totalTabs,
    denom,
    perStripCost,
    perStripMrp,
    perTabCost,
    perTabMrp,
  }
}

const applyPackRules = (ln, patch, source) => {
  const next = { ...ln, ...patch }
  const p = calcPack(next)

  // 1) If pack config complete, auto compute total tablets into quantity (tablet stock unit)
  if (p.isConfigured) {
    // keep integer-looking quantities clean, but allow decimals if needed
    next.quantity = String(p.totalTabs || 0)
  }

  // 2) Sync pack pricing <-> per-tablet pricing when pack dimensions known
  // If user edits pack_cost/pack_mrp, compute unit_cost/mrp
  if (p.denom > 0) {
    if (
      source === "pack_cost" ||
      source === "pack_mrp" ||
      source === "packs" ||
      source === "strips_per_pack" ||
      source === "tablets_per_strip"
    ) {
      if (p.packCost > 0) next.unit_cost = String(p.perTabCost)
      // allow 0 mrp if not provided
      if (p.packMrp > 0) next.mrp = String(p.perTabMrp)
    }

    // If user edits per-tablet cost/mrp, back-calc pack values
    if (source === "unit_cost" || source === "mrp") {
      const uc = n(next.unit_cost)
      const um = n(next.mrp)
      if (uc > 0) next.pack_cost = String(round2(uc * p.denom))
      if (um > 0) next.pack_mrp = String(round2(um * p.denom))
    }
  }

  // 3) If user clears pack fields, do NOT force anything — keep current quantity editable
  return next
}

// per-line calculation (rounded, stable)
const calcLine = (ln) => {
  const p = calcPack(ln)
  const qty = p.isConfigured ? n(p.totalTabs) : n(ln.quantity)

  const rate = n(ln.unit_cost) // per tablet
  const gross = round2(qty * rate)

  const discAmt = n(ln.discount_amount)
  const discPct = n(ln.discount_percent)
  const disc = round2(
    discAmt > 0 ? discAmt : discPct > 0 ? (gross * discPct) / 100 : 0
  )

  const base = round2(Math.max(0, gross - disc))

  const splitP = n(ln.cgst_percent) + n(ln.sgst_percent) + n(ln.igst_percent)
  const taxP = splitP > 0 ? splitP : n(ln.tax_percent)
  const tax = round2((base * taxP) / 100)

  const net = round2(base + tax)
  return { qty, gross, disc, base, taxP, tax, net }
}

const lineIssues = (ln) => {
  const issues = []
  const idOk = Number(ln.item_id) > 0
  if (!idOk) issues.push("Item missing")

  const p = calcPack(ln)
  if (p.isPartial) issues.push("Pack config incomplete")

  if (!String(ln.batch_no || "").trim()) issues.push("Batch required")

  const effQty = p.isConfigured ? n(p.totalTabs) : n(ln.quantity)
  if (effQty <= 0 && n(ln.free_quantity) <= 0) issues.push("Qty/Free required")

  if (n(ln.unit_cost) < 0) issues.push("Unit cost invalid")
  if (n(ln.mrp) < 0) issues.push("Unit MRP invalid")

  // soft check: unit mrp usually >= unit cost (not enforced)
  return issues
}

/* ------------------ UI helpers (premium) ------------------ */
function GlassCard({ className = "", children }) {
  return (
    <Card
      className={[
        "rounded-3xl border-slate-500/70 bg-white/75 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        "shadow-[0_10px_30px_rgba(2,6,23,0.06)]",
        "ring-1 ring-slate-200/40",
        className,
      ].join(" ")}
    >
      {children}
    </Card>
  )
}

function SectionTitle({ icon: Icon, title, count, subtitle }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {typeof count === "number" ? (
          <Badge variant="outline" className="text-xs bg-white">
            {count}
          </Badge>
        ) : null}
      </div>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

function StepPill({ active, children }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        "transition-all",
        active
          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
          : "bg-white/70 text-slate-700 border-slate-500",
      ].join(" ")}
    >
      {children}
    </span>
  )
}

function StatChip({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: "bg-slate-50 border-slate-500 text-slate-700",
    good: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warn: "bg-amber-50 border-amber-200 text-amber-900",
  }
  return (
    <div
      className={[
        "rounded-2xl border px-3 py-2",
        tones[tone] || tones.neutral,
      ].join(" ")}
    >
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}

function LineCard({ ln, idx, readonly, onPatch, onSplit, onRemove }) {
  const c = calcLine(ln)
  const issues = lineIssues(ln)
  const hasIssues = issues.length > 0
  const p = calcPack(ln)

  const qtyLocked = readonly || p.isConfigured
  const clearPackDisabled = readonly

  return (
    <div
      className={[
        "rounded-3xl border p-3 sm:p-4",
        "shadow-[0_6px_18px_rgba(2,6,23,0.05)]",
        hasIssues
          ? "border-amber-200/80 bg-amber-50/50"
          : "border-slate-500/70 bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-white">
              Line {idx + 1}
            </Badge>
            <div className="font-semibold text-slate-900 truncate">
              {ln.item_name ||
                (ln.item_id ? `Item #${ln.item_id}` : "Select item")}
            </div>

            {p.isConfigured ? (
              <Badge
                variant="outline"
                className="text-[10px] bg-slate-900 text-white border-slate-900"
                title="Pack mode enabled"
              >
                Pack mode
              </Badge>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">
              Gross ₹{money(c.gross)}
            </span>
            <span className="text-xs text-slate-500">
              Disc ₹{money(c.disc)}
            </span>
            <span className="text-xs text-slate-500">Tax ₹{money(c.tax)}</span>

            <Badge variant="outline" className="text-xs bg-white">
              Net ₹{money(c.net)}
            </Badge>

            {p.isConfigured ? (
              <Badge variant="outline" className="text-[11px] bg-white">
                {p.packs} pack • {p.spp} strip/pack • {p.tps} tab/strip •{" "}
                {p.totalTabs} tabs
              </Badge>
            ) : null}

            {hasIssues ? (
              <Badge
                variant="outline"
                className="text-[11px] bg-amber-100 text-amber-900 border border-amber-200"
              >
                {issues[0]}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                OK
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-2xl"
            title="Split batch"
            onClick={onSplit}
            disabled={readonly}
          >
            <SplitSquareVertical className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-2xl text-rose-600"
            title="Remove line"
            onClick={onRemove}
            disabled={readonly}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main row */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <div className="space-y-1">
          <Label className="text-xs">
            Qty (tablets){" "}
            {p.isConfigured ? (
              <span className="text-[10px] text-slate-500">
                (auto from packs)
              </span>
            ) : null}
          </Label>
          <Input
            disabled={qtyLocked}
            className={[
              "h-10 rounded-2xl bg-white",
              qtyLocked ? "opacity-90" : "",
            ].join(" ")}
            type="number"
            step="1"
            min="0"
            value={toStr(p.isConfigured ? p.totalTabs : ln.quantity)}
            onChange={(e) => onPatch({ quantity: e.target.value }, "quantity")}
            placeholder={p.isConfigured ? "Auto" : "Enter tablets"}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Free (tablets)</Label>
          <Input
            disabled={readonly}
            className="h-10 rounded-2xl bg-white"
            type="number"
            step="1"
            min="0"
            value={toStr(ln.free_quantity)}
            onChange={(e) =>
              onPatch({ free_quantity: e.target.value }, "free_quantity")
            }
          />
        </div>

        <div className="space-y-1 col-span-2 sm:col-span-2">
          <Label className="text-xs">Batch No</Label>
          <Input
            disabled={readonly}
            className="h-10 rounded-2xl bg-white"
            value={toStr(ln.batch_no)}
            placeholder="Required"
            onChange={(e) => onPatch({ batch_no: e.target.value }, "batch_no")}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Expiry</Label>
          <Input
            disabled={readonly}
            className="h-10 rounded-2xl bg-white"
            type="date"
            value={toStr(ln.expiry_date)}
            onChange={(e) =>
              onPatch({ expiry_date: e.target.value }, "expiry_date")
            }
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">
            Unit Cost (tablet){" "}
            {p.perTabCost > 0 ? (
              <span className="text-[10px] text-slate-500">(auto sync)</span>
            ) : null}
          </Label>
          <Input
            disabled={readonly}
            className="h-10 rounded-2xl bg-white"
            type="number"
            step="0.01"
            min="0"
            value={toStr(ln.unit_cost)}
            onChange={(e) => onPatch({ unit_cost: e.target.value }, "unit_cost")}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">
            Unit MRP (tablet){" "}
            {p.perTabMrp > 0 ? (
              <span className="text-[10px] text-slate-500">(auto sync)</span>
            ) : null}
          </Label>
          <Input
            disabled={readonly}
            className="h-10 rounded-2xl bg-white"
            type="number"
            step="0.01"
            min="0"
            value={toStr(ln.mrp)}
            onChange={(e) => onPatch({ mrp: e.target.value }, "mrp")}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Tax %</Label>
          <Input
            disabled={readonly}
            className="h-10 rounded-2xl bg-white"
            type="number"
            step="0.01"
            min="0"
            value={toStr(ln.tax_percent)}
            onChange={(e) =>
              onPatch({ tax_percent: e.target.value }, "tax_percent")
            }
            placeholder="0"
          />
        </div>

        {/* Pack config + pack pricing */}
        <details className="col-span-2 sm:col-span-4 lg:col-span-8">
          <summary className="cursor-pointer select-none text-xs text-slate-600 mt-2">
            Pack configuration & pack pricing (packs → strips → tablets)
          </summary>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <div className="space-y-1">
              <Label className="text-xs">Packs</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="1"
                min="0"
                value={toStr(ln.packs)}
                onChange={(e) => onPatch({ packs: e.target.value }, "packs")}
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Strips / pack</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="1"
                min="0"
                value={toStr(ln.strips_per_pack)}
                onChange={(e) =>
                  onPatch(
                    { strips_per_pack: e.target.value },
                    "strips_per_pack"
                  )
                }
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tablets / strip</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="1"
                min="0"
                value={toStr(ln.tablets_per_strip)}
                onChange={(e) =>
                  onPatch(
                    { tablets_per_strip: e.target.value },
                    "tablets_per_strip"
                  )
                }
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Total strips</Label>
              <Input
                disabled
                className="h-10 rounded-2xl bg-slate-50"
                value={p.isConfigured ? String(p.totalStrips) : "—"}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Pack Cost (₹/pack)</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="0.01"
                min="0"
                value={toStr(ln.pack_cost)}
                onChange={(e) =>
                  onPatch({ pack_cost: e.target.value }, "pack_cost")
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Pack MRP (₹/pack)</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="0.01"
                min="0"
                value={toStr(ln.pack_mrp)}
                onChange={(e) =>
                  onPatch({ pack_mrp: e.target.value }, "pack_mrp")
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Cost (₹/strip)</Label>
              <Input
                disabled
                className="h-10 rounded-2xl bg-slate-50"
                value={p.perStripCost > 0 ? money(p.perStripCost) : "—"}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">MRP (₹/strip)</Label>
              <Input
                disabled
                className="h-10 rounded-2xl bg-slate-50"
                value={p.perStripMrp > 0 ? money(p.perStripMrp) : "—"}
              />
            </div>

            <div className="col-span-2 sm:col-span-4 lg:col-span-8 grid gap-2 sm:grid-cols-3">
              <StatChip
                label="Total tablets"
                value={p.isConfigured ? String(p.totalTabs) : "—"}
                tone={p.isPartial ? "warn" : "neutral"}
              />
              <StatChip
                label="Cost (₹/tablet)"
                value={p.perTabCost > 0 ? money(p.perTabCost) : (n(ln.unit_cost) > 0 ? money(ln.unit_cost) : "—")}
              />
              <StatChip
                label="MRP (₹/tablet)"
                value={p.perTabMrp > 0 ? money(p.perTabMrp) : (n(ln.mrp) > 0 ? money(ln.mrp) : "—")}
              />
            </div>

            {p.hasAny ? (
              <div className="col-span-2 sm:col-span-4 lg:col-span-8 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  disabled={clearPackDisabled}
                  onClick={() =>
                    onPatch(
                      {
                        packs: "",
                        strips_per_pack: "",
                        tablets_per_strip: "",
                        pack_cost: "",
                        pack_mrp: "",
                      },
                      "clear_pack"
                    )
                  }
                >
                  Clear pack fields
                </Button>
              </div>
            ) : null}

            {p.isPartial ? (
              <div className="col-span-2 sm:col-span-4 lg:col-span-8 rounded-3xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>
                    <div className="font-semibold">Pack config incomplete</div>
                    <div className="opacity-80 mt-1">
                      To auto-calculate tablets + per-unit pricing, fill:
                      Packs, Strips/pack, Tablets/strip. (You can also clear pack fields if not needed.)
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </details>

        {/* Existing extra fields */}
        <details className="col-span-2 sm:col-span-4 lg:col-span-8">
          <summary className="cursor-pointer select-none text-xs text-slate-600 mt-2">
            More (Discount / GST Split / Scheme)
          </summary>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <div className="space-y-1">
              <Label className="text-xs">Disc %</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="0.01"
                min="0"
                value={toStr(ln.discount_percent)}
                onChange={(e) =>
                  onPatch(
                    { discount_percent: e.target.value },
                    "discount_percent"
                  )
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Disc Amt</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="0.01"
                min="0"
                value={toStr(ln.discount_amount)}
                onChange={(e) =>
                  onPatch(
                    { discount_amount: e.target.value },
                    "discount_amount"
                  )
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">CGST %</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="0.01"
                min="0"
                value={toStr(ln.cgst_percent)}
                onChange={(e) =>
                  onPatch({ cgst_percent: e.target.value }, "cgst_percent")
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">SGST %</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="0.01"
                min="0"
                value={toStr(ln.sgst_percent)}
                onChange={(e) =>
                  onPatch({ sgst_percent: e.target.value }, "sgst_percent")
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">IGST %</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                type="number"
                step="0.01"
                min="0"
                value={toStr(ln.igst_percent)}
                onChange={(e) =>
                  onPatch({ igst_percent: e.target.value }, "igst_percent")
                }
              />
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-3 lg:col-span-3">
              <Label className="text-xs">Scheme</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                value={toStr(ln.scheme)}
                onChange={(e) => onPatch({ scheme: e.target.value }, "scheme")}
                placeholder="ex: 10+1"
              />
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-4 lg:col-span-8">
              <Label className="text-xs">Remarks</Label>
              <Input
                disabled={readonly}
                className="h-10 rounded-2xl bg-white"
                value={toStr(ln.remarks)}
                placeholder="Optional"
                onChange={(e) => onPatch({ remarks: e.target.value }, "remarks")}
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}

export default function GrnTab() {
  // -------- lists --------
  const [grnLoading, setGrnLoading] = useState(true)
  const [grns, setGrns] = useState([])

  const [pendingPoLoading, setPendingPoLoading] = useState(true)
  const [pendingPos, setPendingPos] = useState([])

  const [suppliers, setSuppliers] = useState([])
  const [locations, setLocations] = useState([])

  // -------- filters --------
  const [grnQuery, setGrnQuery] = useState("")
  const [grnStatus, setGrnStatus] = useState("ALL")
  const [poPickQuery, setPoPickQuery] = useState("")

  // -------- sheet / editor --------
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mode, setMode] = useState("PO") // "PO" | "DIRECT"
  const [step, setStep] = useState(1) // 1 choose (PO), 2 draft

  const [selectedPo, setSelectedPo] = useState(null)
  const [grnId, setGrnId] = useState(null)
  const [draftStatus, setDraftStatus] = useState("DRAFT")
  const [grnForm, setGrnForm] = useState(emptyForm())
  const [lines, setLines] = useState([])

  const [savingDraft, setSavingDraft] = useState(false)
  const [posting, setPosting] = useState(false)

  // -------- item picker --------
  const [itemQ, setItemQ] = useState("")
  const [itemResults, setItemResults] = useState([])
  const [searchingItems, setSearchingItems] = useState(false)
  const itemWrapRef = useRef(null)

  const readonly = String(draftStatus || "DRAFT") !== "DRAFT"

  const loadMasters = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([listSuppliers(), listLocations()])
      setSuppliers(s.data || [])
      setLocations(l.data || [])
    } catch {
      // silent
    }
  }, [])

  const loadGrns = useCallback(async () => {
    setGrnLoading(true)
    try {
      const params = {}
      if (grnStatus !== "ALL") params.status = grnStatus
      if (grnQuery.trim()) params.q = grnQuery.trim()
      const res = await listGrns(params)
      setGrns(res.data || [])
    } catch (e) {
      toast.error(errText(e, "Failed to load GRNs"))
      setGrns([])
    } finally {
      setGrnLoading(false)
    }
  }, [grnQuery, grnStatus])

  const loadPendingPos = useCallback(async () => {
    setPendingPoLoading(true)
    try {
      const res = await listPendingPos({ q: poPickQuery.trim() || undefined })
      setPendingPos(res.data || [])
    } catch (e) {
      toast.error(errText(e, "Failed to load pending POs"))
      setPendingPos([])
    } finally {
      setPendingPoLoading(false)
    }
  }, [poPickQuery])

  useEffect(() => {
    loadMasters()
    loadGrns()
    loadPendingPos()
  }, [loadMasters, loadGrns, loadPendingPos])

  // close item dropdown on outside click
  useEffect(() => {
    const onDoc = (e) => {
      if (!itemWrapRef.current) return
      if (!itemWrapRef.current.contains(e.target)) setItemResults([])
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const filteredGrns = useMemo(() => {
    const text = grnQuery.trim().toLowerCase()
    if (!text) return grns
    return (grns || []).filter((g) => {
      const s = `${g.grn_number || ""} ${g.invoice_number || ""} ${
        g.supplier?.name || ""
      } ${g.location?.name || ""} ${g.status || ""}`.toLowerCase()
      return s.includes(text)
    })
  }, [grns, grnQuery])

  const totals = useMemo(() => {
    const rows = (lines || []).map(calcLine)

    const subtotal = round2(rows.reduce((s, r) => s + r.gross, 0))
    const discount = round2(rows.reduce((s, r) => s + r.disc, 0))
    const tax = round2(rows.reduce((s, r) => s + r.tax, 0))

    const netLines = round2(rows.reduce((s, r) => s + r.net, 0))
    const extras = round2(
      n(grnForm.freight_amount) +
        n(grnForm.other_charges) +
        n(grnForm.round_off)
    )
    const calculated = round2(netLines + extras)

    const invoice = round2(n(grnForm.supplier_invoice_amount))
    const diff = round2(invoice - calculated)
    const mismatch = invoice > 0 && Math.abs(diff) >= 0.01

    const missingBatch = (lines || []).filter(
      (ln) => !String(ln.batch_no || "").trim()
    ).length

    const qtyIssues = (lines || []).filter((ln) => {
      const p = calcPack(ln)
      const effQty = p.isConfigured ? n(p.totalTabs) : n(ln.quantity)
      return effQty <= 0 && n(ln.free_quantity) <= 0
    }).length

    const itemMissing = (lines || []).filter((ln) => !(Number(ln.item_id) > 0))
      .length

    const packIncomplete = (lines || []).filter((ln) => calcPack(ln).isPartial)
      .length

    return {
      subtotal,
      discount,
      tax,
      netLines,
      extras,
      calculated,
      invoice,
      diff,
      mismatch,
      missingBatch,
      qtyIssues,
      itemMissing,
      packIncomplete,
    }
  }, [lines, grnForm])

  const resetSheet = useCallback(() => {
    setMode("PO")
    setStep(1)
    setSelectedPo(null)
    setGrnId(null)
    setDraftStatus("DRAFT")
    setGrnForm(emptyForm())
    setLines([])
    setItemQ("")
    setItemResults([])
  }, [])

  const openNewGrn = useCallback(() => {
    resetSheet()
    setSheetOpen(true)
  }, [resetSheet])

  const openDraft = useCallback(async (id) => {
    try {
      const res = await getGrn(id)
      const g = res.data

      setGrnId(g.id)
      setDraftStatus(String(g.status || "DRAFT"))

      setMode(g.po_id ? "PO" : "DIRECT")
      setStep(2)

      setSelectedPo(
        g.po_id
          ? {
              id: g.po_id,
              po_number: g.po?.po_number || g.purchase_order?.po_number || "",
            }
          : null
      )

      setGrnForm({
        po_id: g.po_id ? String(g.po_id) : "",
        supplier_id: String(g.supplier_id || ""),
        location_id: String(g.location_id || ""),
        received_date: g.received_date || todayISO(),
        invoice_number: g.invoice_number || "",
        invoice_date: g.invoice_date || "",
        supplier_invoice_amount: toStr(g.supplier_invoice_amount || ""),
        freight_amount: toStr(g.freight_amount || ""),
        other_charges: toStr(g.other_charges || ""),
        round_off: toStr(g.round_off || ""),
        notes: g.notes || "",
        difference_reason: g.difference_reason || "",
      })

      // NOTE: backend stores final (tablet-level) values; pack fields are frontend-only
      setLines(
        (g.items || []).map((it) =>
          makeLine({
            po_item_id: it.po_item_id || null,
            item_id: it.item_id ? Number(it.item_id) : null, // ✅ FIX: correct item_id
            item_name:
              it.item?.name ||
              it.item_name ||
              (it.item_id ? `Item #${it.item_id}` : "Item"),
            batch_no: it.batch_no || "",
            expiry_date: it.expiry_date || "",
            quantity: toStr(it.quantity ?? ""),
            free_quantity: toStr(it.free_quantity ?? ""),
            unit_cost: toStr(it.unit_cost ?? ""),
            mrp: toStr(it.mrp ?? ""),
            discount_percent: toStr(it.discount_percent ?? ""),
            discount_amount: toStr(it.discount_amount ?? ""),
            cgst_percent: toStr(it.cgst_percent ?? ""),
            sgst_percent: toStr(it.sgst_percent ?? ""),
            igst_percent: toStr(it.igst_percent ?? ""),
            tax_percent: toStr(it.tax_percent ?? ""),
            scheme: it.scheme || "",
            remarks: it.remarks || "",
          })
        )
      )

      setSheetOpen(true)
    } catch (e) {
      toast.error(errText(e, "Failed to open GRN"))
    }
  }, [])

  const pickPo = useCallback(async (po) => {
    try {
      const res = await getPoPendingItems(po.id)
      const data = res.data

      setSelectedPo({ id: data.po_id, po_number: data.po_number })
      setMode("PO")
      setStep(2)
      setDraftStatus("DRAFT")
      setGrnId(null)

      setGrnForm((f) => ({
        ...f,
        po_id: String(data.po_id),
        supplier_id: String(data.supplier_id),
        location_id: String(data.location_id),
        received_date: todayISO(),
      }))

      setLines(
        (data.items || []).map((it) => {
          const baseUnitCost = n(it.unit_cost ?? it.item?.default_price ?? 0)
          const baseUnitMrp = n(it.mrp ?? it.item?.default_mrp ?? 0)

          const spp =
            it?.item?.strips_per_pack ??
            it?.item?.stripsPerPack ??
            it?.strips_per_pack ??
            it?.stripsPerPack ??
            ""
          const tps =
            it?.item?.tablets_per_strip ??
            it?.item?.tabletsPerStrip ??
            it?.tablets_per_strip ??
            it?.tabletsPerStrip ??
            ""

          // if pack dimensions exist, compute pack pricing from unit pricing (optional)
          const denom = n(spp) > 0 && n(tps) > 0 ? n(spp) * n(tps) : 0
          const pack_cost = denom > 0 && baseUnitCost > 0 ? round2(baseUnitCost * denom) : ""
          const pack_mrp = denom > 0 && baseUnitMrp > 0 ? round2(baseUnitMrp * denom) : ""

          return makeLine({
            po_item_id: it.po_item_id ?? null,
            item_id: resolvePoItemId(it),
            item_name: it.item?.name || it.item_name || `Item #${it.item_id}`,
            quantity: toStr(it.remaining_qty ?? 0), // tablets by default
            free_quantity: "",
            unit_cost: toStr(baseUnitCost),
            mrp: toStr(baseUnitMrp),
            tax_percent: toStr(it.tax_percent ?? it.item?.default_tax_percent ?? 0),

            // prefill pack hints if master has them
            strips_per_pack: spp ? String(spp) : "",
            tablets_per_strip: tps ? String(tps) : "",
            pack_cost: pack_cost !== "" ? String(pack_cost) : "",
            pack_mrp: pack_mrp !== "" ? String(pack_mrp) : "",
          })
        })
      )

      toast.success("PO pending items loaded")
    } catch (e) {
      toast.error(errText(e, "Failed to load PO pending items"))
    }
  }, [])

  const searchItems = useCallback(async () => {
    const text = itemQ.trim()
    if (!text) return
    setSearchingItems(true)
    try {
      const res = await listInventoryItems({ q: text, limit: 20 })
      const rows = (res.data || []).map(normalizeItem).filter((x) => x.id)
      setItemResults(rows)
    } catch {
      setItemResults([])
    } finally {
      setSearchingItems(false)
    }
  }, [itemQ])

  const addItemToLines = useCallback((raw) => {
    const it = normalizeItem(raw)
    if (!it?.id) {
      toast.error(
        "Item id missing from API response. Fix listInventoryItems output fields."
      )
      return
    }

    const spp = n(it.strips_per_pack) > 0 ? String(it.strips_per_pack) : ""
    const tps = n(it.tablets_per_strip) > 0 ? String(it.tablets_per_strip) : ""

    // If we have pack dimensions, derive pack pricing from default per-tablet (optional)
    const denom = n(spp) > 0 && n(tps) > 0 ? n(spp) * n(tps) : 0
    const baseUnitCost = n(it.default_price ?? 0)
    const baseUnitMrp = n(it.default_mrp ?? 0)
    const pack_cost = denom > 0 && baseUnitCost > 0 ? String(round2(baseUnitCost * denom)) : ""
    const pack_mrp = denom > 0 && baseUnitMrp > 0 ? String(round2(baseUnitMrp * denom)) : ""

    setLines((prev) => [
      ...prev,
      makeLine({
        item_id: Number(it.id),
        item_name: it.name,
        quantity: "1",
        unit_cost: toStr(it.default_price ?? 0),
        mrp: toStr(it.default_mrp ?? 0),
        tax_percent: toStr(it.default_tax_percent ?? 0),

        strips_per_pack: spp,
        tablets_per_strip: tps,
        pack_cost,
        pack_mrp,
      }),
    ])

    setItemQ("")
    setItemResults([])
  }, [])

  const addBlankLine = useCallback(() => {
    setLines((prev) => [...prev, makeLine({})])
  }, [])

  const patchLine = useCallback((key, patch, source = "generic") => {
    setLines((prev) =>
      prev.map((ln) =>
        ln._key === key ? applyPackRules(ln, patch, source) : ln
      )
    )
  }, [])

  const removeLine = useCallback((key) => {
    setLines((prev) => prev.filter((ln) => ln._key !== key))
  }, [])

  const splitLine = useCallback((key) => {
    setLines((prev) => {
      const idx = prev.findIndex((x) => x._key === key)
      if (idx < 0) return prev
      const src = prev[idx]
      const clone = makeLine({
        ...src,
        batch_no: "",
        expiry_date: "",
        quantity: src.quantity,
        free_quantity: "",
      })
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      return next
    })
  }, [])

  const validateDraft = useCallback(() => {
    if (!grnForm.supplier_id) return "Select supplier"
    if (!grnForm.location_id) return "Select location"
    if (!lines.length) return "Add at least 1 batch line"

    for (const ln of lines) {
      const issues = lineIssues(ln)
      if (issues.length) return issues[0]
    }

    if (totals.mismatch && !String(grnForm.difference_reason || "").trim()) {
      return "Difference Reason required (invoice mismatch)"
    }
    return null
  }, [grnForm, lines, totals.mismatch])

  const saveDraft = useCallback(async () => {
    if (readonly) return toast.error("This GRN is not editable")

    const msg = validateDraft()
    if (msg) return toast.error(msg)

    const payload = {
      po_id: grnForm.po_id ? Number(grnForm.po_id) : null,
      supplier_id: Number(grnForm.supplier_id),
      location_id: Number(grnForm.location_id),
      received_date: grnForm.received_date || null,
      invoice_number: grnForm.invoice_number || "",
      invoice_date: grnForm.invoice_date || null,
      supplier_invoice_amount: String(grnForm.supplier_invoice_amount || 0),
      freight_amount: String(grnForm.freight_amount || 0),
      other_charges: String(grnForm.other_charges || 0),
      round_off: String(grnForm.round_off || 0),
      notes: grnForm.notes || "",
      difference_reason: grnForm.difference_reason || "",
      items: lines.map((ln) => {
        // ✅ Final computed values (frontend-only pack fields are NOT sent)
        const p = calcPack(ln)
        const qtyFinal = p.isConfigured ? n(p.totalTabs) : n(ln.quantity)
        const denom = p.denom

        const unitCostFinal =
          denom > 0 && n(ln.pack_cost) > 0 ? n(p.perTabCost) : n(ln.unit_cost)
        const unitMrpFinal =
          denom > 0 && n(ln.pack_mrp) > 0 ? n(p.perTabMrp) : n(ln.mrp)

        return {
          po_item_id: ln.po_item_id || null,
          item_id: Number(ln.item_id) || null,
          batch_no: ln.batch_no,
          expiry_date: ln.expiry_date || null,
          quantity: String(qtyFinal || 0),
          free_quantity: String(ln.free_quantity || 0),
          unit_cost: String(unitCostFinal || 0),
          mrp: String(unitMrpFinal || 0),
          discount_percent: String(ln.discount_percent || 0),
          discount_amount: String(ln.discount_amount || 0),
          cgst_percent: String(ln.cgst_percent || 0),
          sgst_percent: String(ln.sgst_percent || 0),
          igst_percent: String(ln.igst_percent || 0),
          tax_percent: String(ln.tax_percent || 0),
          scheme: ln.scheme || "",
          remarks: ln.remarks || "",
        }
      }),
    }

    setSavingDraft(true)
    try {
      if (!grnId) {
        const res = await createGrn(payload)
        setGrnId(res.data?.id || null)
        setDraftStatus("DRAFT")
        toast.success("GRN draft created")
      } else {
        await updateGrn(grnId, payload)
        toast.success("GRN draft updated")
      }
      await loadGrns()
      await loadPendingPos()
    } catch (e) {
      toast.error(errText(e, "Failed to save draft"))
    } finally {
      setSavingDraft(false)
    }
  }, [
    readonly,
    validateDraft,
    grnForm,
    lines,
    grnId,
    loadGrns,
    loadPendingPos,
  ])

  const doPost = useCallback(async () => {
    if (readonly) return toast.error("This GRN cannot be posted")
    if (!grnId) return toast.error("Save draft first")

    const msg = validateDraft()
    if (msg) return toast.error(msg)

    setPosting(true)
    try {
      await postGrn(grnId, { difference_reason: grnForm.difference_reason || "" })
      toast.success("GRN posted — stock updated")
      setSheetOpen(false)
      resetSheet()
      await loadGrns()
      await loadPendingPos()
    } catch (e) {
      toast.error(errText(e, "Failed to post GRN"))
    } finally {
      setPosting(false)
    }
  }, [
    readonly,
    grnId,
    validateDraft,
    grnForm.difference_reason,
    resetSheet,
    loadGrns,
    loadPendingPos,
  ])

  const kpis = useMemo(() => {
    const all = grns?.length || 0
    const draft = (grns || []).filter((x) => x.status === "DRAFT").length
    const posted = (grns || []).filter((x) => x.status === "POSTED").length
    const mismatch = (grns || []).filter(
      (x) =>
        Math.abs(n(x.amount_difference || 0)) >= 0.01 &&
        n(x.supplier_invoice_amount || 0) > 0
    ).length
    return { all, draft, posted, mismatch }
  }, [grns])

  return (
    <div className="space-y-6">
      {/* Premium page header */}
      <div className="rounded-3xl border border-slate-500/70 bg-gradient-to-b from-white to-slate-50/70 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-base font-semibold text-slate-900">
                  Goods Receipt Notes
                </div>
                <div className="text-xs text-slate-500">
                  Premium workflow: PO → batches → save draft → post stock • Pack
                  pricing supported (packs/strips/tablets)
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                loadPendingPos()
                loadGrns()
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-1" />
              Refresh all
            </Button>
            <Button className="rounded-2xl" onClick={openNewGrn}>
              <Plus className="h-4 w-4 mr-1" />
              New GRN
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <StatChip label="Total GRNs" value={kpis.all} />
          <StatChip label="Draft" value={kpis.draft} tone="warn" />
          <StatChip label="Posted" value={kpis.posted} tone="good" />
          <StatChip
            label="Invoice mismatch"
            value={kpis.mismatch}
            tone={kpis.mismatch ? "warn" : "neutral"}
          />
        </div>
      </div>

      {/* ---------------- PO Pending ---------------- */}
      <GlassCard>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle
            icon={PackageOpen}
            title="PO Pending GRN"
            count={pendingPos.length}
            subtitle="Pick PO → auto-fill pending items → enter batches → save draft → post."
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 rounded-2xl"
              onClick={loadPendingPos}
            >
              <RefreshCcw className="w-3 h-3" />
              Refresh
            </Button>
            <Button size="sm" className="gap-1 rounded-2xl" onClick={openNewGrn}>
              <Plus className="w-3 h-3" />
              New GRN
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  value={poPickQuery}
                  onChange={(e) => setPoPickQuery(e.target.value)}
                  placeholder="Search PO number..."
                  className="pl-9 bg-white rounded-2xl h-10"
                />
              </div>
              <Button
                variant="outline"
                className="rounded-2xl h-10"
                onClick={loadPendingPos}
              >
                Search
              </Button>
            </div>

            <div className="text-xs text-slate-500">
              {pendingPoLoading ? "Loading…" : `${pendingPos.length} pending PO(s)`}
            </div>
          </div>

          <div className="border border-slate-500/70 rounded-3xl overflow-hidden bg-white">
            <div className="hidden md:grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.8fr] px-4 py-3 text-xs font-semibold text-slate-500 bg-slate-50">
              <span>PO</span>
              <span>Supplier</span>
              <span>Location / Date</span>
              <span>Pending</span>
              <span className="text-right">Action</span>
            </div>

            <div className="max-h-[280px] overflow-auto divide-y divide-slate-100">
              {pendingPoLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-10 w-full rounded-2xl" />
                  <Skeleton className="h-10 w-full rounded-2xl" />
                </div>
              ) : pendingPos.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-400" />
                  No pending POs.
                </div>
              ) : (
                pendingPos.map((po) => (
                  <div
                    key={po.id}
                    className="px-4 py-4 md:py-3 md:grid md:grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.8fr] md:items-center text-sm md:text-xs hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {po.po_number}
                      </div>
                      <div className="text-slate-500 text-xs md:text-[11px]">
                        {formatDate(po.order_date)}
                      </div>
                    </div>

                    <div className="mt-2 md:mt-0">
                      <div className="text-slate-900">{po.supplier?.name || "—"}</div>
                      <div className="text-slate-500 text-xs md:text-[11px]">
                        {po.supplier?.phone || po.supplier?.email || "—"}
                      </div>
                    </div>

                    <div className="mt-2 md:mt-0">
                      <div className="text-slate-900">{po.location?.name || "—"}</div>
                      <div className="text-slate-500 text-xs md:text-[11px]">
                        Status: {String(po.status || "")}
                      </div>
                    </div>

                    <div className="mt-2 md:mt-0">
                      <Badge variant="outline" className="text-[11px] bg-white">
                        {po.pending_items_count || 0} items
                      </Badge>
                    </div>

                    <div className="mt-3 md:mt-0 flex justify-end">
                      <Button
                        size="sm"
                        className="gap-1 rounded-2xl"
                        onClick={() => {
                          openNewGrn()
                          pickPo(po)
                        }}
                      >
                        <Link2 className="w-3 h-3" />
                        Create GRN
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </GlassCard>

      {/* ---------------- GRN List ---------------- */}
      <GlassCard>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionTitle
            icon={ClipboardList}
            title="GRN Registry"
            count={filteredGrns.length}
            subtitle="Draft → Save → Post (updates stock + PO received qty/status)."
          />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-10 rounded-2xl"
              onClick={loadGrns}
            >
              <RefreshCcw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="h-10 rounded-2xl gap-1"
              onClick={openNewGrn}
            >
              <Plus className="w-4 h-4" />
              New GRN
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Search GRN / supplier / invoice..."
                  value={grnQuery}
                  onChange={(e) => setGrnQuery(e.target.value)}
                  className="h-10 bg-white rounded-2xl pl-9"
                />
              </div>

              <div className="w-full sm:w-44">
                <Select value={grnStatus} onValueChange={setGrnStatus}>
                  <SelectTrigger className="h-10 bg-white rounded-2xl">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="POSTED">Posted</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" className="h-10 rounded-2xl" onClick={loadGrns}>
                Apply
              </Button>
            </div>

            <div className="text-xs text-slate-500">
              {grnLoading ? "Loading…" : `${filteredGrns.length} result(s)`}
            </div>
          </div>

          <div className="border border-slate-500/70 rounded-3xl overflow-hidden bg-white">
            <div className="hidden md:grid grid-cols-[1.2fr,1.1fr,1.2fr,0.9fr,0.9fr,0.9fr] px-4 py-3 text-xs font-semibold text-slate-500 bg-slate-50">
              <span>GRN</span>
              <span>Supplier</span>
              <span>Location / Invoice</span>
              <span>Amounts</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="max-h-[420px] overflow-auto divide-y divide-slate-100">
              {grnLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-10 w-full rounded-2xl" />
                  <Skeleton className="h-10 w-full rounded-2xl" />
                </div>
              ) : filteredGrns.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-400" />
                  No GRNs found.
                </div>
              ) : (
                filteredGrns.map((grn) => {
                  const diff = n(grn.amount_difference || 0)
                  const hasMismatch =
                    Math.abs(diff) >= 0.01 && n(grn.supplier_invoice_amount || 0) > 0

                  return (
                    <div
                      key={grn.id}
                      className="px-4 py-4 md:py-3 md:grid md:grid-cols-[1.2fr,1.1fr,1.2fr,0.9fr,0.9fr,0.9fr] md:items-center text-sm md:text-xs hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {grn.grn_number || `GRN-${String(grn.id).padStart(6, "0")}`}
                        </div>
                        <div className="text-slate-500 text-xs md:text-[11px]">
                          Received: {formatDate(grn.received_date)}
                        </div>
                      </div>

                      <div className="mt-2 md:mt-0">
                        <div className="text-slate-900">{grn.supplier?.name || "—"}</div>
                        <div className="text-slate-500 text-xs md:text-[11px]">
                          {grn.supplier?.phone || grn.supplier?.email || "—"}
                        </div>
                      </div>

                      <div className="mt-2 md:mt-0">
                        <div className="text-slate-900">{grn.location?.name || "—"}</div>
                        <div className="text-slate-500 text-xs md:text-[11px]">
                          Inv: {grn.invoice_number || "—"}{" "}
                          {grn.invoice_date ? `• ${formatDate(grn.invoice_date)}` : ""}
                        </div>
                      </div>

                      <div className="mt-2 md:mt-0">
                        <div className="text-slate-900">
                          Inv: ₹{money(grn.supplier_invoice_amount || 0)}
                        </div>
                        <div className="flex items-center gap-2 text-xs md:text-[11px] text-slate-500">
                          <span>Calc: ₹{money(grn.calculated_grn_amount || 0)}</span>
                          {hasMismatch ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-50 text-amber-800 border-amber-200"
                            >
                              Diff ₹{money(diff)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 md:mt-0">
                        <Badge
                          variant="outline"
                          className={[
                            "text-[11px] md:text-[10px] capitalize bg-white",
                            grn.status === "POSTED"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "",
                            grn.status === "CANCELLED"
                              ? "bg-rose-50 border-rose-200 text-rose-800"
                              : "",
                            grn.status === "DRAFT"
                              ? "bg-slate-50 border-slate-500 text-slate-700"
                              : "",
                          ].join(" ")}
                        >
                          {(grn.status || "DRAFT").toLowerCase()}
                        </Badge>
                      </div>

                      <div className="mt-3 md:mt-0 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-2xl bg-white"
                          title="Open"
                          onClick={() => openDraft(grn.id)}
                        >
                          <ClipboardList className="w-4 h-4" />
                        </Button>

                        {grn.status === "DRAFT" ? (
                          <Button
                            size="sm"
                            className="h-9 gap-1 rounded-2xl"
                            onClick={() => openDraft(grn.id)}
                          >
                            <ArrowRight className="w-3 h-3" />
                            Continue
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </CardContent>
      </GlassCard>

      {/* ---------------- GRN Sheet ---------------- */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v)
          if (!v) resetSheet()
        }}
      >
        <SheetContent
          side="right"
          className="w-screen sm:w-full max-w-none sm:max-w-none p-0 overflow-hidden bg-white"
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <SheetHeader className="p-5 border-b bg-white sticky top-0 z-20">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <SheetTitle className="text-base font-semibold">
                    {grnId ? `GRN (${draftStatus})` : "New GRN (Draft)"}
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    Choose PO (optional) → add batches → save draft → post. Pack pricing:
                    enter Packs/Strips/Tablets + Pack Cost/MRP → unit tablet values auto-calculated.
                  </SheetDescription>
                </div>

                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setSheetOpen(false)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Select
                  value={mode}
                  onValueChange={(v) => {
                    resetSheet()
                    setMode(v)
                    setStep(v === "PO" ? 1 : 2)
                    setSheetOpen(true)
                  }}
                >
                  <SelectTrigger className="h-10 w-64 rounded-2xl bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PO">GRN from PO (recommended)</SelectItem>
                    <SelectItem value="DIRECT">Direct GRN (no PO)</SelectItem>
                  </SelectContent>
                </Select>

                <StepPill active={step === 1}>1 • Select</StepPill>
                <StepPill active={step === 2}>2 • Draft</StepPill>

                {selectedPo?.po_number ? (
                  <Badge
                    variant="outline"
                    className="text-xs flex items-center gap-1 bg-white"
                  >
                    <Link2 className="w-3 h-3" />
                    {selectedPo.po_number}
                  </Badge>
                ) : null}

                {readonly ? (
                  <Badge variant="outline" className="text-xs bg-slate-50">
                    Read-only
                  </Badge>
                ) : null}
              </div>
            </SheetHeader>

            {/* Body */}
            <div className="flex-1 overflow-auto p-5 bg-gradient-to-b from-slate-50/40 to-white space-y-4">
              {/* Step 1: PO Selection */}
              {mode === "PO" && step === 1 ? (
                <GlassCard className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <PackageOpen className="h-4 w-4" />
                      Choose a PO (pending)
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Selecting a PO auto-fills supplier/location + pending items.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Input
                          className="bg-white rounded-2xl h-10"
                          value={poPickQuery}
                          onChange={(e) => setPoPickQuery(e.target.value)}
                          placeholder="Search PO..."
                        />
                        <Button
                          variant="outline"
                          className="rounded-2xl h-10"
                          onClick={loadPendingPos}
                        >
                          Search
                        </Button>
                      </div>
                      <div className="text-xs text-slate-500">
                        {pendingPoLoading ? "Loading…" : `${pendingPos.length} PO(s)`}
                      </div>
                    </div>

                    <div className="border rounded-3xl overflow-hidden">
                      <div className="max-h-[420px] overflow-auto divide-y">
                        {pendingPoLoading ? (
                          <div className="p-4 space-y-2">
                            <Skeleton className="h-12 w-full rounded-2xl" />
                            <Skeleton className="h-12 w-full rounded-2xl" />
                          </div>
                        ) : pendingPos.length === 0 ? (
                          <div className="p-6 text-sm text-slate-500">No pending PO.</div>
                        ) : (
                          pendingPos.map((po) => (
                            <button
                              type="button"
                              key={po.id}
                              onClick={() => {
                                pickPo(po)
                                setStep(2)
                              }}
                              className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">
                                    {po.po_number}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate mt-1">
                                    {po.supplier?.name || "—"} • {po.location?.name || "—"} •{" "}
                                    {formatDate(po.order_date)}
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-xs shrink-0 bg-white">
                                  {po.pending_items_count || 0} pending
                                </Badge>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => {
                          setMode("DIRECT")
                          setStep(2)
                        }}
                      >
                        Skip PO (Direct GRN)
                      </Button>
                    </div>
                  </CardContent>
                </GlassCard>
              ) : null}

              {/* Draft editor */}
              {step === 2 ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),380px]">
                  {/* Left */}
                  <div className="space-y-4">
                    <GlassCard className="bg-white">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Invoice details</CardTitle>
                        <p className="text-xs text-slate-500">
                          Supplier/location locked if linked to PO.
                        </p>
                      </CardHeader>

                      <CardContent className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Supplier</Label>
                          <Select
                            value={grnForm.supplier_id}
                            onValueChange={(v) => setGrnForm((f) => ({ ...f, supplier_id: v }))}
                            disabled={(mode === "PO" && !!selectedPo) || readonly}
                          >
                            <SelectTrigger className="bg-white rounded-2xl h-10">
                              <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Receiving location</Label>
                          <Select
                            value={grnForm.location_id}
                            onValueChange={(v) => setGrnForm((f) => ({ ...f, location_id: v }))}
                            disabled={(mode === "PO" && !!selectedPo) || readonly}
                          >
                            <SelectTrigger className="bg-white rounded-2xl h-10">
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((l) => (
                                <SelectItem key={l.id} value={String(l.id)}>
                                  {l.code ? `${l.code} — ${l.name}` : l.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Invoice number</Label>
                          <Input
                            disabled={readonly}
                            className="bg-white rounded-2xl h-10"
                            value={grnForm.invoice_number}
                            onChange={(e) => setGrnForm((f) => ({ ...f, invoice_number: e.target.value }))}
                            placeholder="Supplier bill no"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Invoice date</Label>
                          <Input
                            disabled={readonly}
                            type="date"
                            className="bg-white rounded-2xl h-10"
                            value={grnForm.invoice_date}
                            onChange={(e) => setGrnForm((f) => ({ ...f, invoice_date: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Supplier invoice amount (net)</Label>
                          <Input
                            disabled={readonly}
                            type="number"
                            step="0.01"
                            min="0"
                            className="bg-white rounded-2xl h-10"
                            value={grnForm.supplier_invoice_amount}
                            onChange={(e) => setGrnForm((f) => ({ ...f, supplier_invoice_amount: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label>Freight</Label>
                            <Input
                              disabled={readonly}
                              type="number"
                              step="0.01"
                              min="0"
                              className="bg-white rounded-2xl h-10"
                              value={grnForm.freight_amount}
                              onChange={(e) => setGrnForm((f) => ({ ...f, freight_amount: e.target.value }))}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Other</Label>
                            <Input
                              disabled={readonly}
                              type="number"
                              step="0.01"
                              min="0"
                              className="bg-white rounded-2xl h-10"
                              value={grnForm.other_charges}
                              onChange={(e) => setGrnForm((f) => ({ ...f, other_charges: e.target.value }))}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Round off</Label>
                            <Input
                              disabled={readonly}
                              type="number"
                              step="0.01"
                              className="bg-white rounded-2xl h-10"
                              value={grnForm.round_off}
                              onChange={(e) => setGrnForm((f) => ({ ...f, round_off: e.target.value }))}
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-2 space-y-1.5">
                          <Label>Notes</Label>
                          <Textarea
                            disabled={readonly}
                            className="bg-white rounded-2xl"
                            value={grnForm.notes}
                            onChange={(e) => setGrnForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="Optional"
                          />
                        </div>
                      </CardContent>
                    </GlassCard>

                    {/* Batch Lines */}
                    <GlassCard className="bg-white">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm">Batch lines</CardTitle>
                            <p className="text-xs text-slate-500">
                              Each line supports Pack pricing: enter Packs/Strips/Tablets + Pack Cost/MRP → unit values auto.
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={addBlankLine}
                            disabled={readonly}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add line
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {/* Item search */}
                        <div ref={itemWrapRef} className="relative">
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="relative w-full">
                              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                              <Input
                                disabled={readonly}
                                className="bg-white rounded-2xl h-10 pl-9"
                                value={itemQ}
                                onChange={(e) => setItemQ(e.target.value)}
                                placeholder="Search item by name / code / generic…"
                                onKeyDown={(e) => e.key === "Enter" && searchItems()}
                              />
                            </div>

                            <Button
                              disabled={readonly || searchingItems}
                              variant="outline"
                              className="rounded-2xl h-10"
                              onClick={searchItems}
                            >
                              {searchingItems ? "…" : "Search"}
                            </Button>
                          </div>

                          {itemResults.length > 0 ? (
                            <div className="absolute z-30 mt-2 w-full rounded-3xl border border-slate-500 bg-white shadow-[0_18px_50px_rgba(2,6,23,0.12)] overflow-hidden">
                              <div className="max-h-72 overflow-auto divide-y">
                                {itemResults.map((it) => (
                                  <button
                                    type="button"
                                    key={it.id}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => addItemToLines(it)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="text-sm font-semibold text-slate-900">{it.name}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      {it.code || "—"} • {it.generic_name || "—"} • Default ₹{money(it.default_price || 0)}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {lines.length === 0 ? (
                          <div className="rounded-3xl border border-dashed p-6 text-sm text-slate-500 bg-slate-50">
                            No batch lines yet. Search an item above (or select a PO) to start.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {lines.map((ln, idx) => (
                              <LineCard
                                key={ln._key}
                                ln={ln}
                                idx={idx}
                                readonly={readonly}
                                onPatch={(patch, source) => patchLine(ln._key, patch, source)}
                                onSplit={() => splitLine(ln._key)}
                                onRemove={() => removeLine(ln._key)}
                              />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </GlassCard>
                  </div>

                  {/* Right: totals/actions */}
                  <div className="space-y-4 lg:sticky lg:top-4 h-fit">
                    <GlassCard className="bg-white">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Totals</CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <StatChip label="Subtotal" value={`₹${money(totals.subtotal)}`} />
                          <StatChip label="Discount" value={`₹${money(totals.discount)}`} />
                          <StatChip label="Tax" value={`₹${money(totals.tax)}`} />
                          <StatChip label="Extras" value={`₹${money(totals.extras)}`} />
                        </div>

                        <Separator />

                        <div className="rounded-3xl border border-slate-500 bg-slate-50 p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-600">Calculated</div>
                            <div className="text-base font-semibold text-slate-900">
                              ₹{money(totals.calculated)}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-xs text-slate-600">Invoice</div>
                            <div className="text-sm font-semibold text-slate-900">
                              ₹{money(totals.invoice)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <StatChip label="Lines" value={lines.length} />
                          <StatChip
                            label="Item miss"
                            value={totals.itemMissing}
                            tone={totals.itemMissing ? "warn" : "neutral"}
                          />
                          <StatChip
                            label="Batch miss"
                            value={totals.missingBatch}
                            tone={totals.missingBatch ? "warn" : "neutral"}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <StatChip
                            label="Qty issues"
                            value={totals.qtyIssues}
                            tone={totals.qtyIssues ? "warn" : "neutral"}
                          />
                          <StatChip
                            label="Pack incomplete"
                            value={totals.packIncomplete}
                            tone={totals.packIncomplete ? "warn" : "neutral"}
                          />
                        </div>

                        {totals.mismatch ? (
                          <div className="rounded-3xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 mt-0.5" />
                              <div className="w-full">
                                <div className="font-semibold">
                                  Invoice mismatch: Diff ₹{money(totals.diff)}
                                </div>
                                <div className="opacity-80 mt-1">
                                  Add Difference Reason to save/post.
                                </div>
                                <Input
                                  disabled={readonly}
                                  className="mt-2 bg-white rounded-2xl h-10"
                                  value={grnForm.difference_reason}
                                  onChange={(e) =>
                                    setGrnForm((f) => ({ ...f, difference_reason: e.target.value }))
                                  }
                                  placeholder="Short supply / damaged / rounding / manual…"
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {selectedPo?.po_number ? (
                          <div className="rounded-3xl bg-slate-50 border border-slate-500 p-4 text-xs text-slate-700">
                            <div className="font-semibold flex items-center gap-1">
                              <Link2 className="w-3 h-3" /> Linked PO
                            </div>
                            <div className="mt-1">{selectedPo.po_number}</div>
                          </div>
                        ) : null}
                      </CardContent>
                    </GlassCard>

                    <GlassCard className="bg-white">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button
                          className="w-full rounded-2xl h-11"
                          onClick={saveDraft}
                          disabled={savingDraft || readonly}
                        >
                          {savingDraft ? "Saving…" : grnId ? "Update Draft" : "Save Draft"}
                        </Button>

                        <Button
                          className="w-full rounded-2xl h-11"
                          variant="outline"
                          onClick={doPost}
                          disabled={posting || !grnId || readonly}
                        >
                          {posting ? "Posting…" : "Post GRN (Update Stock)"}
                        </Button>

                        {!grnId ? (
                          <p className="text-xs text-slate-500">
                            Save draft first. Post enabled after draft exists.
                          </p>
                        ) : null}
                        {readonly ? (
                          <p className="text-xs text-slate-500">This GRN is read-only.</p>
                        ) : null}
                      </CardContent>
                    </GlassCard>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Mobile footer actions */}
            <div className="lg:hidden border-t bg-white p-4">
              <div className="flex gap-2">
                <Button
                  className="w-full rounded-2xl h-11"
                  onClick={saveDraft}
                  disabled={savingDraft || readonly}
                >
                  {savingDraft ? "Saving…" : "Save Draft"}
                </Button>
                <Button
                  className="w-full rounded-2xl h-11"
                  variant="outline"
                  onClick={doPost}
                  disabled={posting || !grnId || readonly}
                >
                  {posting ? "Posting…" : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
