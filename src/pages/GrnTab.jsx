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

    return {
        ...raw,
        id: id ? Number(id) : null,
        name,
        code,
        generic_name,
        default_price,
        default_mrp,
        default_tax_percent,
    }
}

const resolvePoItemId = (it) => {
    const id = it?.item_id ?? it?.item?.id ?? it?.item?.item_id ?? null
    return id ? Number(id) : null
}

const makeLine = (partial = {}) => ({
    _key: uuid(),
    po_item_id: null,
    item_id: null,
    item_name: "",
    batch_no: "",
    expiry_date: "",
    quantity: "",
    free_quantity: "",
    unit_cost: "",
    mrp: "",
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

// per-line calculation (rounded, stable)
const calcLine = (ln) => {
    const qty = n(ln.quantity)
    const rate = n(ln.unit_cost)
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
    if (!String(ln.batch_no || "").trim()) issues.push("Batch required")
    if (n(ln.quantity) <= 0 && n(ln.free_quantity) <= 0) issues.push("Qty/Free required")
    if (n(ln.unit_cost) < 0) issues.push("Rate invalid")
    if (n(ln.mrp) < 0) issues.push("MRP invalid")
    return issues
}

function StepPill({ active, children }) {
    return (
        <span
            className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
                active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200",
            ].join(" ")}
        >
            {children}
        </span>
    )
}

function LineCard({ ln, readonly, onPatch, onSplit, onRemove }) {
    const c = calcLine(ln)
    const issues = lineIssues(ln)
    const hasIssues = issues.length > 0

    return (
        <div
            className={[
                "rounded-2xl border p-3",
                hasIssues ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white",
            ].join(" ")}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                        {ln.item_name || (ln.item_id ? `Item #${ln.item_id}` : "Select item")}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Gross ₹{money(c.gross)}</span>
                        <span className="text-xs text-slate-500">Disc ₹{money(c.disc)}</span>
                        <span className="text-xs text-slate-500">Tax ₹{money(c.tax)}</span>
                        <Badge variant="outline" className="text-xs">
                            Net ₹{money(c.net)}
                        </Badge>

                        {hasIssues ? (
                            <Badge
                                variant="outline"
                                className="text-xs bg-amber-100 text-amber-900 border border-amber-200"
                            >
                                {issues[0]}
                            </Badge>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
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
                        className="h-9 w-9 text-rose-600"
                        title="Remove line"
                        onClick={onRemove}
                        disabled={readonly}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                        disabled={readonly}
                        className="h-9 rounded-2xl bg-white"
                        type="number"
                        step="0.01"
                        value={toStr(ln.quantity)}
                        onChange={(e) => onPatch({ quantity: e.target.value })}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">Free</Label>
                    <Input
                        disabled={readonly}
                        className="h-9 rounded-2xl bg-white"
                        type="number"
                        step="0.01"
                        value={toStr(ln.free_quantity)}
                        onChange={(e) => onPatch({ free_quantity: e.target.value })}
                    />
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-2">
                    <Label className="text-xs">Batch No</Label>
                    <Input
                        disabled={readonly}
                        className="h-9 rounded-2xl bg-white"
                        value={toStr(ln.batch_no)}
                        placeholder="Required"
                        onChange={(e) => onPatch({ batch_no: e.target.value })}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">Expiry</Label>
                    <Input
                        disabled={readonly}
                        className="h-9 rounded-2xl bg-white"
                        type="date"
                        value={toStr(ln.expiry_date)}
                        onChange={(e) => onPatch({ expiry_date: e.target.value })}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">Rate</Label>
                    <Input
                        disabled={readonly}
                        className="h-9 rounded-2xl bg-white"
                        type="number"
                        step="0.01"
                        value={toStr(ln.unit_cost)}
                        onChange={(e) => onPatch({ unit_cost: e.target.value })}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">MRP</Label>
                    <Input
                        disabled={readonly}
                        className="h-9 rounded-2xl bg-white"
                        type="number"
                        step="0.01"
                        value={toStr(ln.mrp)}
                        onChange={(e) => onPatch({ mrp: e.target.value })}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">Tax %</Label>
                    <Input
                        disabled={readonly}
                        className="h-9 rounded-2xl bg-white"
                        type="number"
                        step="0.01"
                        value={toStr(ln.tax_percent)}
                        onChange={(e) => onPatch({ tax_percent: e.target.value })}
                    />
                </div>

                <details className="col-span-2 sm:col-span-4 lg:col-span-8">
                    <summary className="cursor-pointer select-none text-xs text-slate-600 mt-1">
                        More (Discount / GST Split / Scheme)
                    </summary>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                        <div className="space-y-1">
                            <Label className="text-xs">Disc %</Label>
                            <Input
                                disabled={readonly}
                                className="h-9 rounded-2xl bg-white"
                                type="number"
                                step="0.01"
                                value={toStr(ln.discount_percent)}
                                onChange={(e) => onPatch({ discount_percent: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Disc Amt</Label>
                            <Input
                                disabled={readonly}
                                className="h-9 rounded-2xl bg-white"
                                type="number"
                                step="0.01"
                                value={toStr(ln.discount_amount)}
                                onChange={(e) => onPatch({ discount_amount: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">CGST %</Label>
                            <Input
                                disabled={readonly}
                                className="h-9 rounded-2xl bg-white"
                                type="number"
                                step="0.01"
                                value={toStr(ln.cgst_percent)}
                                onChange={(e) => onPatch({ cgst_percent: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">SGST %</Label>
                            <Input
                                disabled={readonly}
                                className="h-9 rounded-2xl bg-white"
                                type="number"
                                step="0.01"
                                value={toStr(ln.sgst_percent)}
                                onChange={(e) => onPatch({ sgst_percent: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">IGST %</Label>
                            <Input
                                disabled={readonly}
                                className="h-9 rounded-2xl bg-white"
                                type="number"
                                step="0.01"
                                value={toStr(ln.igst_percent)}
                                onChange={(e) => onPatch({ igst_percent: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1 col-span-2 sm:col-span-3 lg:col-span-3">
                            <Label className="text-xs">Scheme</Label>
                            <Input
                                disabled={readonly}
                                className="h-9 rounded-2xl bg-white"
                                value={toStr(ln.scheme)}
                                onChange={(e) => onPatch({ scheme: e.target.value })}
                                placeholder="ex: 10+1"
                            />
                        </div>

                        <div className="space-y-1 col-span-2 sm:col-span-4 lg:col-span-8">
                            <Label className="text-xs">Remarks</Label>
                            <Input
                                disabled={readonly}
                                className="h-9 rounded-2xl bg-white"
                                value={toStr(ln.remarks)}
                                placeholder="Optional"
                                onChange={(e) => onPatch({ remarks: e.target.value })}
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
            const s = `${g.grn_number || ""} ${g.invoice_number || ""} ${g.supplier?.name || ""} ${g.location?.name || ""
                } ${g.status || ""}`.toLowerCase()
            return s.includes(text)
        })
    }, [grns, grnQuery])

    const totals = useMemo(() => {
        const rows = (lines || []).map(calcLine)

        const subtotal = round2(rows.reduce((s, r) => s + r.gross, 0))
        const discount = round2(rows.reduce((s, r) => s + r.disc, 0))
        const tax = round2(rows.reduce((s, r) => s + r.tax, 0))

        const netLines = round2(rows.reduce((s, r) => s + r.net, 0))
        const extras = round2(n(grnForm.freight_amount) + n(grnForm.other_charges) + n(grnForm.round_off))
        const calculated = round2(netLines + extras)

        const invoice = round2(n(grnForm.supplier_invoice_amount))
        const diff = round2(invoice - calculated)
        const mismatch = invoice > 0 && Math.abs(diff) >= 0.01

        const missingBatch = (lines || []).filter((ln) => !String(ln.batch_no || "").trim()).length
        const qtyIssues = (lines || []).filter((ln) => n(ln.quantity) <= 0 && n(ln.free_quantity) <= 0).length
        const itemMissing = (lines || []).filter((ln) => !(Number(ln.item_id) > 0)).length

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

    const openDraft = useCallback(
        async (id) => {
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

                setLines(
                    (g.items || []).map((it) =>
                        makeLine({
                            po_item_id: it.po_item_id || null,
                            item_id: it.item_id ? Number(it.item_id) : null,
                            item_name: it.item?.name || it.item_name || `Item #${it.item_id}`,
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
        },
        []
    )

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
                (data.items || []).map((it) =>
                    makeLine({
                        po_item_id: it.po_item_id ?? null,
                        item_id: resolvePoItemId(it),
                        item_name: it.item?.name || it.item_name || `Item #${it.item_id}`,
                        quantity: toStr(it.remaining_qty ?? 0),
                        free_quantity: "",
                        unit_cost: toStr(it.unit_cost ?? it.item?.default_price ?? 0),
                        mrp: toStr(it.mrp ?? it.item?.default_mrp ?? 0),
                        tax_percent: toStr(it.tax_percent ?? it.item?.default_tax_percent ?? 0),
                    })
                )
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
            toast.error("Item id missing from API response. Fix listInventoryItems output fields.")
            return
        }

        setLines((prev) => [
            ...prev,
            makeLine({
                item_id: Number(it.id),
                item_name: it.name,
                quantity: "1",
                unit_cost: toStr(it.default_price ?? 0),
                mrp: toStr(it.default_mrp ?? 0),
                tax_percent: toStr(it.default_tax_percent ?? 0),
            }),
        ])

        setItemQ("")
        setItemResults([])
    }, [])

    const addBlankLine = useCallback(() => {
        setLines((prev) => [...prev, makeLine({})])
    }, [])

    const patchLine = useCallback((key, patch) => {
        setLines((prev) => prev.map((ln) => (ln._key === key ? { ...ln, ...patch } : ln)))
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
                quantity: "",
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
            items: lines.map((ln) => ({
                po_item_id: ln.po_item_id || null,
                item_id: Number(ln.item_id) || null,
                batch_no: ln.batch_no,
                expiry_date: ln.expiry_date || null,
                quantity: String(ln.quantity || 0),
                free_quantity: String(ln.free_quantity || 0),
                unit_cost: String(ln.unit_cost || 0),
                mrp: String(ln.mrp || 0),
                discount_percent: String(ln.discount_percent || 0),
                discount_amount: String(ln.discount_amount || 0),
                cgst_percent: String(ln.cgst_percent || 0),
                sgst_percent: String(ln.sgst_percent || 0),
                igst_percent: String(ln.igst_percent || 0),
                tax_percent: String(ln.tax_percent || 0),
                scheme: ln.scheme || "",
                remarks: ln.remarks || "",
            })),
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
    }, [readonly, validateDraft, grnForm, lines, grnId, loadGrns, loadPendingPos])

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
    }, [readonly, grnId, validateDraft, grnForm.difference_reason, resetSheet, loadGrns, loadPendingPos])

    return (
        <div className="space-y-4">
            {/* ---------------- PO Pending ---------------- */}
            <Card className="rounded-3xl border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            PO Pending GRN
                            <Badge variant="outline" className="text-xs">
                                {pendingPos.length}
                            </Badge>
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                            Pick PO → auto-fill pending items → enter batches → save draft → post.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-1" onClick={loadPendingPos}>
                            <RefreshCcw className="w-3 h-3" />
                            Refresh
                        </Button>
                        <Button size="sm" className="gap-1" onClick={openNewGrn}>
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
                                    className="pl-9 bg-white rounded-2xl"
                                />
                            </div>
                            <Button variant="outline" className="rounded-2xl" onClick={loadPendingPos}>
                                Search
                            </Button>
                        </div>

                        <div className="text-xs text-slate-500">
                            {pendingPoLoading ? "Loading…" : `${pendingPos.length} pending PO(s)`}
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                        <div className="hidden md:grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.8fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                            <span>PO</span>
                            <span>Supplier</span>
                            <span>Location / Date</span>
                            <span>Pending</span>
                            <span className="text-right">Action</span>
                        </div>

                        <div className="max-h-[280px] overflow-auto divide-y divide-slate-100">
                            {pendingPoLoading ? (
                                <div className="p-3 space-y-2">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ) : pendingPos.length === 0 ? (
                                <div className="p-4 text-sm text-slate-500">No pending POs.</div>
                            ) : (
                                pendingPos.map((po) => (
                                    <div
                                        key={po.id}
                                        className="px-3 py-3 md:py-2 md:grid md:grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.8fr] md:items-center text-sm md:text-xs"
                                    >
                                        <div>
                                            <div className="font-medium text-slate-900">{po.po_number}</div>
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
                                            <Badge variant="outline" className="text-[11px]">
                                                {po.pending_items_count || 0} items
                                            </Badge>
                                        </div>

                                        <div className="mt-3 md:mt-0 flex justify-end">
                                            <Button
                                                size="sm"
                                                className="gap-1"
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
            </Card>

            {/* ---------------- GRN List ---------------- */}
            <Card className="rounded-3xl border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            Goods Receipt Notes
                            <Badge variant="outline" className="text-xs">
                                {filteredGrns.length}
                            </Badge>
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                            Draft → Save → Post (updates stock + PO received qty/status).
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-9" onClick={loadGrns}>
                            <RefreshCcw className="w-4 h-4" />
                            Refresh
                        </Button>
                        <Button size="sm" className="h-9 gap-1" onClick={openNewGrn}>
                            <Plus className="w-4 h-4" />
                            New GRN
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="w-full sm:w-72">
                                <Input
                                    placeholder="Search GRN / supplier / invoice..."
                                    value={grnQuery}
                                    onChange={(e) => setGrnQuery(e.target.value)}
                                    className="h-9 bg-white rounded-2xl"
                                />
                            </div>

                            <div className="w-full sm:w-44">
                                <Select value={grnStatus} onValueChange={setGrnStatus}>
                                    <SelectTrigger className="h-9 bg-white rounded-2xl">
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

                            <Button variant="outline" className="h-9 rounded-2xl" onClick={loadGrns}>
                                Apply
                            </Button>
                        </div>

                        <div className="text-xs text-slate-500">
                            {grnLoading ? "Loading…" : `${filteredGrns.length} result(s)`}
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                        <div className="hidden md:grid grid-cols-[1.2fr,1.1fr,1.2fr,0.9fr,0.9fr,0.9fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                            <span>GRN</span>
                            <span>Supplier</span>
                            <span>Location / Invoice</span>
                            <span>Amounts</span>
                            <span>Status</span>
                            <span className="text-right">Actions</span>
                        </div>

                        <div className="max-h-[420px] overflow-auto divide-y divide-slate-100">
                            {grnLoading ? (
                                <div className="p-3 space-y-2">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ) : filteredGrns.length === 0 ? (
                                <div className="p-4 text-sm text-slate-500">No GRNs found.</div>
                            ) : (
                                filteredGrns.map((grn) => {
                                    const diff = n(grn.amount_difference || 0)
                                    const hasMismatch =
                                        Math.abs(diff) >= 0.01 && n(grn.supplier_invoice_amount || 0) > 0

                                    return (
                                        <div
                                            key={grn.id}
                                            className="px-3 py-3 md:py-2 md:grid md:grid-cols-[1.2fr,1.1fr,1.2fr,0.9fr,0.9fr,0.9fr] md:items-center text-sm md:text-xs hover:bg-slate-50"
                                        >
                                            <div>
                                                <div className="font-medium text-slate-900">
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
                                                        "text-[11px] md:text-[10px] capitalize",
                                                        grn.status === "POSTED"
                                                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                                            : "",
                                                        grn.status === "CANCELLED"
                                                            ? "bg-rose-50 border-rose-200 text-rose-800"
                                                            : "",
                                                        grn.status === "DRAFT"
                                                            ? "bg-slate-50 border-slate-200 text-slate-700"
                                                            : "",
                                                    ].join(" ")}
                                                >
                                                    {(grn.status || "DRAFT").toLowerCase()}
                                                </Badge>
                                            </div>

                                            <div className="mt-3 md:mt-0 flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    title="Open"
                                                    onClick={() => openDraft(grn.id)}
                                                >
                                                    <ClipboardList className="w-4 h-4" />
                                                </Button>

                                                {grn.status === "DRAFT" ? (
                                                    <Button size="sm" className="h-8 gap-1" onClick={() => openDraft(grn.id)}>
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
            </Card>

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
                    className="w-screen sm:w-full max-w-none sm:max-w-none p-0 overflow-hidden"
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
                                        Choose PO (optional) → add batches → save draft → post.
                                    </SheetDescription>
                                </div>

                                <Button variant="outline" className="rounded-2xl" onClick={() => setSheetOpen(false)}>
                                    <X className="h-4 w-4 mr-1" />
                                    Close
                                </Button>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Select
                                    value={mode}
                                    onValueChange={(v) => {
                                        // switching mode always resets for safety
                                        resetSheet()
                                        setMode(v)
                                        setStep(v === "PO" ? 1 : 2)
                                        setSheetOpen(true)
                                    }}
                                >
                                    <SelectTrigger className="h-9 w-56 rounded-2xl bg-white">
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
                                    <Badge variant="outline" className="text-xs flex items-center gap-1">
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
                        <div className="flex-1 overflow-auto p-5 bg-slate-50/40 space-y-4">
                            {/* Step 1: PO Selection */}
                            {mode === "PO" && step === 1 ? (
                                <Card className="rounded-3xl border-slate-200 bg-white">
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
                                                    className="bg-white rounded-2xl"
                                                    value={poPickQuery}
                                                    onChange={(e) => setPoPickQuery(e.target.value)}
                                                    placeholder="Search PO..."
                                                />
                                                <Button variant="outline" className="rounded-2xl" onClick={loadPendingPos}>
                                                    Search
                                                </Button>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {pendingPoLoading ? "Loading…" : `${pendingPos.length} PO(s)`}
                                            </div>
                                        </div>

                                        <div className="border rounded-2xl overflow-hidden">
                                            <div className="max-h-[420px] overflow-auto divide-y">
                                                {pendingPoLoading ? (
                                                    <div className="p-3 space-y-2">
                                                        <Skeleton className="h-10 w-full" />
                                                        <Skeleton className="h-10 w-full" />
                                                    </div>
                                                ) : pendingPos.length === 0 ? (
                                                    <div className="p-4 text-sm text-slate-500">No pending PO.</div>
                                                ) : (
                                                    pendingPos.map((po) => (
                                                        <button
                                                            type="button"
                                                            key={po.id}
                                                            onClick={() => {
                                                                pickPo(po)
                                                                setStep(2)
                                                            }}
                                                            className="w-full text-left p-3 hover:bg-slate-50"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="font-semibold text-slate-900 truncate">{po.po_number}</div>
                                                                    <div className="text-xs text-slate-500 truncate">
                                                                        {po.supplier?.name || "—"} • {po.location?.name || "—"} •{" "}
                                                                        {formatDate(po.order_date)}
                                                                    </div>
                                                                </div>
                                                                <Badge variant="outline" className="text-xs shrink-0">
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
                                </Card>
                            ) : null}

                            {/* Draft editor */}
                            {step === 2 ? (
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),360px]">
                                    {/* Left */}
                                    <div className="space-y-4">
                                        <Card className="rounded-3xl border-slate-200 bg-white">
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
                                                        <SelectTrigger className="bg-white rounded-2xl">
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
                                                        <SelectTrigger className="bg-white rounded-2xl">
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
                                                        className="bg-white rounded-2xl"
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
                                                        className="bg-white rounded-2xl"
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
                                                        className="bg-white rounded-2xl"
                                                        value={grnForm.supplier_invoice_amount}
                                                        onChange={(e) =>
                                                            setGrnForm((f) => ({ ...f, supplier_invoice_amount: e.target.value }))
                                                        }
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
                                                            className="bg-white rounded-2xl"
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
                                                            className="bg-white rounded-2xl"
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
                                                            className="bg-white rounded-2xl"
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
                                        </Card>

                                        {/* Batch Lines */}
                                        <Card className="rounded-3xl border-slate-200 bg-white">
                                            <CardHeader className="pb-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <CardTitle className="text-sm">Batch lines</CardTitle>
                                                        <p className="text-xs text-slate-500">
                                                            Card layout (no irregular jumps). Each line shows Gross/Disc/Tax/Net.
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
                                                        <Input
                                                            disabled={readonly}
                                                            className="bg-white rounded-2xl"
                                                            value={itemQ}
                                                            onChange={(e) => setItemQ(e.target.value)}
                                                            placeholder="Search item by name / code / generic…"
                                                            onKeyDown={(e) => e.key === "Enter" && searchItems()}
                                                        />
                                                        <Button
                                                            disabled={readonly || searchingItems}
                                                            variant="outline"
                                                            className="rounded-2xl"
                                                            onClick={searchItems}
                                                        >
                                                            {searchingItems ? "…" : "Search"}
                                                        </Button>
                                                    </div>

                                                    {itemResults.length > 0 ? (
                                                        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                                            <div className="max-h-72 overflow-auto divide-y">
                                                                {itemResults.map((it) => (
                                                                    <button
                                                                        type="button"
                                                                        key={it.id}
                                                                        onMouseDown={(e) => e.preventDefault()} // keep focus stable
                                                                        onClick={() => addItemToLines(it)}
                                                                        className="w-full text-left px-3 py-2 hover:bg-slate-50"
                                                                    >
                                                                        <div className="text-sm font-medium text-slate-900">{it.name}</div>
                                                                        <div className="text-xs text-slate-500">
                                                                            {it.code || "—"} • {it.generic_name || "—"} • Default ₹{money(it.default_price || 0)}
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>

                                                {lines.length === 0 ? (
                                                    <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500 bg-slate-50">
                                                        No batch lines yet. Search an item above (or select a PO) to start.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {lines.map((ln) => (
                                                            <LineCard
                                                                key={ln._key}
                                                                ln={ln}
                                                                readonly={readonly}
                                                                onPatch={(patch) => patchLine(ln._key, patch)}
                                                                onSplit={() => splitLine(ln._key)}
                                                                onRemove={() => removeLine(ln._key)}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Right: totals/actions */}
                                    <div className="space-y-4 lg:sticky lg:top-4 h-fit">
                                        <Card className="rounded-3xl border-slate-200 bg-white">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Totals</CardTitle>
                                            </CardHeader>

                                            <CardContent className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Subtotal</span>
                                                    <span className="font-medium">₹{money(totals.subtotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Discount</span>
                                                    <span className="font-medium">₹{money(totals.discount)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Tax</span>
                                                    <span className="font-medium">₹{money(totals.tax)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Extras</span>
                                                    <span className="font-medium">₹{money(totals.extras)}</span>
                                                </div>

                                                <Separator />

                                                <div className="flex justify-between">
                                                    <span className="text-slate-900 font-semibold">Calculated</span>
                                                    <span className="text-slate-900 font-semibold">₹{money(totals.calculated)}</span>
                                                </div>

                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Invoice</span>
                                                    <span className="font-medium">₹{money(totals.invoice)}</span>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                                                    <div className="flex justify-between">
                                                        <span>Lines</span>
                                                        <span className="font-semibold">{lines.length}</span>
                                                    </div>
                                                    <div className="flex justify-between mt-1">
                                                        <span>Item missing</span>
                                                        <span className={totals.itemMissing ? "font-semibold text-amber-900" : "font-semibold"}>
                                                            {totals.itemMissing}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between mt-1">
                                                        <span>Missing batch</span>
                                                        <span className={totals.missingBatch ? "font-semibold text-amber-900" : "font-semibold"}>
                                                            {totals.missingBatch}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between mt-1">
                                                        <span>Qty/Free issues</span>
                                                        <span className={totals.qtyIssues ? "font-semibold text-amber-900" : "font-semibold"}>
                                                            {totals.qtyIssues}
                                                        </span>
                                                    </div>
                                                </div>

                                                {totals.mismatch ? (
                                                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                                                        <div className="flex items-start gap-2">
                                                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                                                            <div className="w-full">
                                                                <div className="font-semibold">
                                                                    Invoice mismatch: Diff ₹{money(totals.diff)}
                                                                </div>
                                                                <div className="opacity-80 mt-1">Add Difference Reason to save/post.</div>
                                                                <Input
                                                                    disabled={readonly}
                                                                    className="mt-2 bg-white rounded-2xl"
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
                                                    <div className="rounded-2xl bg-slate-50 border p-3 text-xs text-slate-700">
                                                        <div className="font-semibold flex items-center gap-1">
                                                            <Link2 className="w-3 h-3" /> Linked PO
                                                        </div>
                                                        <div className="mt-1">{selectedPo.po_number}</div>
                                                    </div>
                                                ) : null}
                                            </CardContent>
                                        </Card>

                                        <Card className="rounded-3xl border-slate-200 bg-white">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Actions</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <Button className="w-full rounded-2xl" onClick={saveDraft} disabled={savingDraft || readonly}>
                                                    {savingDraft ? "Saving…" : grnId ? "Update Draft" : "Save Draft"}
                                                </Button>

                                                <Button
                                                    className="w-full rounded-2xl"
                                                    variant="outline"
                                                    onClick={doPost}
                                                    disabled={posting || !grnId || readonly}
                                                >
                                                    {posting ? "Posting…" : "Post GRN (Update Stock)"}
                                                </Button>

                                                {!grnId ? (
                                                    <p className="text-xs text-slate-500">Save draft first. Post enabled after draft exists.</p>
                                                ) : null}
                                                {readonly ? <p className="text-xs text-slate-500">This GRN is read-only.</p> : null}
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Mobile footer actions */}
                        <div className="lg:hidden border-t bg-white p-4">
                            <div className="flex gap-2">
                                <Button className="w-full rounded-2xl" onClick={saveDraft} disabled={savingDraft || readonly}>
                                    {savingDraft ? "Saving…" : "Save Draft"}
                                </Button>
                                <Button
                                    className="w-full rounded-2xl"
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
