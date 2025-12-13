// FILE: src/pharmacy/GRN.jsx
import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  ReceiptText,
  Printer,
  X,
  AlertTriangle,
} from 'lucide-react'

import {
  listGRN,
  createGRN,
  listSuppliers,
  listLocations,
  listMedicines,
  listPO,
  getGrnPdf,
} from '../api/pharmacy'

import PermGate from '../components/PermGate'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectContent,
  SelectValue,
} from '@/components/ui/select'

function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const NONE = '__none__'
const toSel = (val) => (val === '' || val == null ? NONE : String(val))
const fromSel = (val) => (val === NONE ? '' : Number(val))

const n = (v) => {
  if (v === '' || v == null) return 0
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const round2 = (x) => Math.round((n(x) + Number.EPSILON) * 100) / 100

function formatMoney(x) {
  return round2(x).toFixed(2)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function GRN() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [suppliers, setSuppliers] = useState([])
  const [locations, setLocations] = useState([])
  const [meds, setMeds] = useState([])
  const [pos, setPOs] = useState([])

  const [v, setV] = useState({
    supplier_id: '',
    location_id: '',
    po_id: '',
    received_date: todayStr(),
    invoice_number: '',
    invoice_date: '',
    supplier_invoice_amount: '',

    freight_amount: '',
    other_charges: '',
    round_off: '',
    difference_reason: '',
    notes: '',

    items: [],
  })

  const resetForm = () => {
    setV({
      supplier_id: '',
      location_id: '',
      po_id: '',
      received_date: todayStr(),
      invoice_number: '',
      invoice_date: '',
      supplier_invoice_amount: '',
      freight_amount: '',
      other_charges: '',
      round_off: '',
      difference_reason: '',
      notes: '',
      items: [],
    })
  }

  const addItem = () =>
    setV((s) => ({
      ...s,
      items: [
        ...s.items,
        {
          item_id: '',
          po_item_id: '',
          batch_no: '',
          expiry_date: '',
          quantity: 1,
          free_quantity: 0,
          unit_cost: '',
          mrp: '',

          discount_percent: '',
          discount_amount: '',

          tax_percent: '',
          cgst_percent: '',
          sgst_percent: '',
          igst_percent: '',

          scheme: '',
          remarks: '',
        },
      ],
    }))

  const setItem = (idx, patch) =>
    setV((s) => ({
      ...s,
      items: s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }))

  const delItem = (idx) =>
    setV((s) => ({
      ...s,
      items: s.items.filter((_, i) => i !== idx),
    }))

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await listGRN()
      setRows(data || [])
    } catch (e) {
      toast.error('Failed to load GRNs', {
        description: e?.response?.data?.detail || 'Please retry.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [s, l, m, p] = await Promise.all([
          listSuppliers().then((r) => r.data || []),
          listLocations().then((r) => r.data || []),
          listMedicines({ limit: 1000, is_active: true }).then((r) => r.data || []),
          listPO({ status: 'approved' }).then((r) => r.data || []),
        ])
        setSuppliers(s)
        setLocations(l)
        setMeds(m)
        setPOs(p)
      } catch (e) {
        toast.error('Failed to load lookups', {
          description: e?.response?.data?.detail || 'Please refresh and try again.',
        })
      }
    })()
  }, [])

  // -----------------------------
  // Totals (client-side estimate)
  // -----------------------------
  const calc = useMemo(() => {
    let qty = 0
    let subtotal = 0
    let discount = 0
    let taxable = 0
    let tax = 0
    let lines = v.items.length

    for (const it of v.items) {
      const q = n(it.quantity)
      const rate = n(it.unit_cost)
      qty += q

      const gross = q * rate
      const discAmt = n(it.discount_amount)
      const discPct = n(it.discount_percent)
      const computedDisc = discAmt > 0 ? discAmt : (discPct > 0 ? (gross * discPct) / 100 : 0)
      const base = Math.max(0, gross - computedDisc)

      discount += computedDisc
      taxable += base
      subtotal += gross

      // tax split > fallback
      const igstP = n(it.igst_percent)
      const cgstP = n(it.cgst_percent)
      const sgstP = n(it.sgst_percent)
      const tp = n(it.tax_percent)

      let lineTax = 0
      if (igstP + cgstP + sgstP > 0) {
        lineTax = (base * (igstP + cgstP + sgstP)) / 100
      } else if (tp > 0) {
        lineTax = (base * tp) / 100
      }
      tax += lineTax
    }

    const extras = n(v.freight_amount) + n(v.other_charges) + n(v.round_off)
    const calculated = taxable + tax + extras
    const invoice = n(v.supplier_invoice_amount)
    const diff = invoice - calculated

    return {
      lines,
      qty,
      subtotal,
      discount,
      taxable,
      tax,
      extras,
      calculated,
      invoice,
      diff,
    }
  }, [v.items, v.freight_amount, v.other_charges, v.round_off, v.supplier_invoice_amount])

  const validate = () => {
    if (!v.supplier_id) return 'Please select a supplier.'
    if (!v.location_id) return 'Please select a location.'
    if (!Array.isArray(v.items) || v.items.length === 0) return 'Add at least one item.'

    for (let i = 0; i < v.items.length; i++) {
      const it = v.items[i]
      if (!it.item_id) return `Row ${i + 1}: select an item/medicine.`
      if (!it.batch_no?.trim()) return `Row ${i + 1}: enter batch no.`
      if (!it.expiry_date) return `Row ${i + 1}: select expiry date.`
      if (!(n(it.quantity) > 0)) return `Row ${i + 1}: quantity must be > 0.`
      if (!(n(it.free_quantity) >= 0)) return `Row ${i + 1}: free quantity must be >= 0.`
      if (!(n(it.unit_cost) >= 0)) return `Row ${i + 1}: unit cost must be >= 0.`
      if (!(n(it.mrp) >= 0)) return `Row ${i + 1}: MRP must be >= 0.`
    }

    // if invoice amount provided and mismatch, require reason
    if (n(v.supplier_invoice_amount) > 0 && Math.abs(calc.diff) >= 0.01) {
      if (!v.difference_reason?.trim()) {
        return 'Invoice mismatch detected. Please enter Difference Reason.'
      }
    }

    return null
  }

  const save = async () => {
    const err = validate()
    if (err) {
      toast.error('Cannot save GRN', { description: err })
      return
    }

    // Build payload matching backend schemas
    const payload = {
      supplier_id: Number(v.supplier_id),
      location_id: Number(v.location_id),
      po_id: v.po_id ? Number(v.po_id) : null,

      received_date: v.received_date || null,
      invoice_number: v.invoice_number || '',
      invoice_date: v.invoice_date || null,

      supplier_invoice_amount: n(v.supplier_invoice_amount),
      freight_amount: n(v.freight_amount),
      other_charges: n(v.other_charges),
      round_off: n(v.round_off),
      difference_reason: v.difference_reason || '',
      notes: v.notes || '',

      items: v.items.map((it) => ({
        item_id: Number(it.item_id),
        po_item_id: it.po_item_id ? Number(it.po_item_id) : null,

        batch_no: (it.batch_no || '').trim(),
        expiry_date: it.expiry_date || null,

        quantity: n(it.quantity),
        free_quantity: n(it.free_quantity),

        unit_cost: n(it.unit_cost),
        mrp: n(it.mrp),

        discount_percent: n(it.discount_percent),
        discount_amount: n(it.discount_amount),

        tax_percent: n(it.tax_percent),
        cgst_percent: n(it.cgst_percent),
        sgst_percent: n(it.sgst_percent),
        igst_percent: n(it.igst_percent),

        scheme: it.scheme || '',
        remarks: it.remarks || '',
      })),
    }

    setSaving(true)
    try {
      const res = await createGRN(payload)
      const id = res?.data?.id
      setOpen(false)
      resetForm()
      await load()
      toast.success('GRN created', {
        description: id
          ? `GRN-${String(id).padStart(6, '0')} • ${payload.items.length} line(s)`
          : 'Saved.',
      })
    } catch (e) {
      toast.error('Save failed', {
        description: e?.response?.data?.detail || 'Please retry.',
      })
    } finally {
      setSaving(false)
    }
  }

  const printGrn = async (id) => {
    if (!id) return
    try {
      const blob = await getGrnPdf(id)
      openPdfBlob(blob)
    } catch (e) {
      toast.error('Unable to open GRN PDF', {
        description: e?.response?.data?.detail || e.message || 'Please try again.',
      })
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Pharmacy · Goods Receipt (GRN)</h1>
        <PermGate anyOf={['pharmacy.procure.manage', 'pharmacy.inventory.grn.manage']}>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New GRN
          </Button>
        </PermGate>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5" />
            Recent GRNs
          </CardTitle>

          {loading && (
            <span className="inline-flex items-center text-xs text-gray-500">
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Loading…
            </span>
          )}
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {(rows || []).map((r) => (
                <TableRow key={r.id} className="hover:bg-gray-50">
                  <TableCell>{r.grn_number || `GRN-${String(r.id).padStart(6, '0')}`}</TableCell>
                  <TableCell>{r.supplier?.name || r.supplier_name || r.supplier_id}</TableCell>
                  <TableCell>{r.location?.code || r.location_code || r.location_id}</TableCell>
                  <TableCell>{r.invoice_number || '—'}</TableCell>
                  <TableCell>
                    {r.received_date
                      ? new Date(r.received_date).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => printGrn(r.id)}
                      title="Print GRN / PDF"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-sm text-gray-500">
                    No GRNs yet.
                  </TableCell>
                </TableRow>
              )}

              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-4">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 animate-pulse rounded bg-gray-200 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ------------------ Modal (Centered) ------------------ */}
      <Dialog
        open={open}
        onOpenChange={(val) => {
          setOpen(val)
          if (!val) resetForm()
        }}
      >
        <DialogContent
          className="
            w-[95vw] sm:max-w-5xl
            max-h-[85vh] overflow-y-auto
            rounded-2xl
          "
        >
          <DialogHeader className="pr-10">
            <DialogTitle className="flex items-center justify-between">
              <span>New GRN</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Header */}
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div className="md:col-span-2">
              <Label>Supplier</Label>
              <Select
                value={v.supplier_id ? String(v.supplier_id) : undefined}
                onValueChange={(val) => setV((s) => ({ ...s, supplier_id: Number(val) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier…" />
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

            <div>
              <Label>Location</Label>
              <Select
                value={v.location_id ? String(v.location_id) : undefined}
                onValueChange={(val) => setV((s) => ({ ...s, location_id: Number(val) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.code} — {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>PO (optional)</Label>
              <Select value={toSel(v.po_id)} onValueChange={(val) => setV((s) => ({ ...s, po_id: fromSel(val) }))}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {pos.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {`PO-${String(p.id).padStart(6, '0')} (${p.supplier_name || p.supplier_id})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Received Date</Label>
              <Input
                type="date"
                value={v.received_date || ''}
                onChange={(e) => setV((s) => ({ ...s, received_date: e.target.value }))}
              />
            </div>

            <div>
              <Label>Invoice No</Label>
              <Input
                value={v.invoice_number}
                onChange={(e) => setV((s) => ({ ...s, invoice_number: e.target.value }))}
                placeholder="Supplier invoice number"
              />
            </div>

            <div>
              <Label>Invoice Date</Label>
              <Input
                type="date"
                value={v.invoice_date || ''}
                onChange={(e) => setV((s) => ({ ...s, invoice_date: e.target.value }))}
              />
            </div>

            <div>
              <Label>Supplier Invoice Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={v.supplier_invoice_amount}
                onChange={(e) => setV((s) => ({ ...s, supplier_invoice_amount: e.target.value }))}
                placeholder="Net payable"
              />
            </div>

            <div>
              <Label>Freight</Label>
              <Input
                type="number"
                step="0.01"
                value={v.freight_amount}
                onChange={(e) => setV((s) => ({ ...s, freight_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Other Charges</Label>
              <Input
                type="number"
                step="0.01"
                value={v.other_charges}
                onChange={(e) => setV((s) => ({ ...s, other_charges: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Round Off</Label>
              <Input
                type="number"
                step="0.01"
                value={v.round_off}
                onChange={(e) => setV((s) => ({ ...s, round_off: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="md:col-span-4">
              <Label>Notes</Label>
              <Input
                value={v.notes}
                onChange={(e) => setV((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>

          {/* Items */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] uppercase tracking-wide text-gray-600">Items</Label>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="mt-2 space-y-2">
              <AnimatePresence initial={false}>
                {v.items.map((it, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-2xl border p-3"
                  >
                    <div className="grid gap-2 md:grid-cols-12 items-end">
                      <div className="md:col-span-4">
                        <Label>Medicine</Label>
                        <Select
                          value={it.item_id ? String(it.item_id) : undefined}
                          onValueChange={(val) => setItem(idx, { item_id: Number(val) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select medicine" />
                          </SelectTrigger>
                          <SelectContent>
                            {meds.map((m) => (
                              <SelectItem key={m.id} value={String(m.id)}>
                                {m.code} — {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2">
                        <Label>Batch No</Label>
                        <Input
                          value={it.batch_no}
                          onChange={(e) => setItem(idx, { batch_no: e.target.value })}
                          placeholder="Batch"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>Expiry</Label>
                        <Input
                          type="date"
                          value={it.expiry_date}
                          onChange={(e) => setItem(idx, { expiry_date: e.target.value })}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <Label>Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => setItem(idx, { quantity: e.target.value })}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <Label>Free</Label>
                        <Input
                          type="number"
                          min={0}
                          value={it.free_quantity}
                          onChange={(e) => setItem(idx, { free_quantity: e.target.value })}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>Unit Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.unit_cost}
                          onChange={(e) => setItem(idx, { unit_cost: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>MRP</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.mrp}
                          onChange={(e) => setItem(idx, { mrp: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>Disc %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.discount_percent}
                          onChange={(e) => setItem(idx, { discount_percent: e.target.value })}
                          placeholder="0"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>Disc Amt</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.discount_amount}
                          onChange={(e) => setItem(idx, { discount_amount: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>CGST %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.cgst_percent}
                          onChange={(e) => setItem(idx, { cgst_percent: e.target.value })}
                          placeholder="0"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>SGST %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.sgst_percent}
                          onChange={(e) => setItem(idx, { sgst_percent: e.target.value })}
                          placeholder="0"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>IGST %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.igst_percent}
                          onChange={(e) => setItem(idx, { igst_percent: e.target.value })}
                          placeholder="0"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>Tax % (Fallback)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={it.tax_percent}
                          onChange={(e) => setItem(idx, { tax_percent: e.target.value })}
                          placeholder="0"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <Label>Scheme</Label>
                        <Input
                          value={it.scheme}
                          onChange={(e) => setItem(idx, { scheme: e.target.value })}
                          placeholder="ex: 10+1"
                        />
                      </div>

                      <div className="md:col-span-5">
                        <Label>Remarks</Label>
                        <Input
                          value={it.remarks}
                          onChange={(e) => setItem(idx, { remarks: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>

                      <div className="md:col-span-12 flex justify-end">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => delItem(idx)}
                          className="text-rose-600 hover:text-rose-700"
                          title="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {v.items.length === 0 && (
                <div className="text-xs text-gray-500">No items yet.</div>
              )}
            </div>
          </div>

          {/* Totals / Mismatch */}
          <div className="mt-4 rounded-2xl border bg-gray-50 p-3 text-sm">
            <div className="grid gap-2 md:grid-cols-6">
              <div><span className="text-gray-500">Lines:</span> {calc.lines}</div>
              <div><span className="text-gray-500">Total Qty:</span> {round2(calc.qty)}</div>
              <div><span className="text-gray-500">Subtotal:</span> {formatMoney(calc.subtotal)}</div>
              <div><span className="text-gray-500">Discount:</span> {formatMoney(calc.discount)}</div>
              <div><span className="text-gray-500">Tax:</span> {formatMoney(calc.tax)}</div>
              <div><span className="text-gray-500">Extras:</span> {formatMoney(calc.extras)}</div>
            </div>

            <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="font-medium">
                Calculated GRN Amount: {formatMoney(calc.calculated)}
              </div>

              <div className="text-right">
                <div className="text-gray-600">
                  Supplier Invoice: {formatMoney(calc.invoice)}
                </div>

                {calc.invoice > 0 && Math.abs(calc.diff) >= 0.01 && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    Difference: {formatMoney(calc.diff)}
                  </div>
                )}
              </div>
            </div>

            {calc.invoice > 0 && Math.abs(calc.diff) >= 0.01 && (
              <div className="mt-3">
                <Label>Difference Reason (required)</Label>
                <Input
                  value={v.difference_reason}
                  onChange={(e) => setV((s) => ({ ...s, difference_reason: e.target.value }))}
                  placeholder="Rounding / short supply / damaged / manual adjustment…"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save GRN'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
