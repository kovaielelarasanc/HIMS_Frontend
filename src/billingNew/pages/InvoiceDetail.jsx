// FILE: src/pages/billing/InvoiceDetail.jsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
    ArrowLeft,
    Plus,
    CheckCircle2,
    BadgeIndianRupee,
    Ban,
    Download,
    Printer,
    RefreshCcw,
} from "lucide-react"

import {
    getInvoice,
    listCaseInvoices,
    addManualLine,
    approveInvoice,
    postInvoice,
    voidInvoice,
    recordPayment,
    isCanceledError,
} from "@/api/billings"
import { useCan } from "../hooks/useCan"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const cx = (...a) => a.filter(Boolean).join(" ")

function fmtDate(v) {
    if (!v) return "-"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString()
}

function fmtMoney(v) {
    if (v === null || v === undefined || v === "") return "-"
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n)
}

function statusBadge(status) {
    const s = String(status || "UNKNOWN").toUpperCase()
    const map = {
        DRAFT: "bg-muted text-foreground",
        APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
        POSTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
        VOID: "bg-rose-50 text-rose-700 border-rose-200",
    }
    return cx("border", map[s] || "bg-muted text-foreground")
}

function normalizeInvoice(payload) {
    // supports: { invoice: {...}, lines:[...] } or direct invoice object
    const inv = payload?.invoice ?? payload ?? {}
    const lines =
        inv?.lines ??
        inv?.invoice_lines ??
        payload?.lines ??
        payload?.invoice_lines ??
        inv?.items ??
        []
    return { ...inv, _lines: Array.isArray(lines) ? lines : [] }
}

export default function InvoiceDetail() {
    const { caseId, invoiceId } = useParams()
    const navigate = useNavigate()
    const can = useCan()

    const [loading, setLoading] = useState(true)
    const [invoice, setInvoice] = useState(null)

    // Dialog states
    const [openAddLine, setOpenAddLine] = useState(false)
    const [openVoid, setOpenVoid] = useState(false)
    const [openPay, setOpenPay] = useState(false)

    // Add manual line form
    const [lineForm, setLineForm] = useState({
        service_group: "MISC",
        item_type: "MANUAL",
        item_id: null,
        item_code: "",
        description: "",
        qty: 1,
        unit_price: "",
        discount_amount: 0,
        tax_percent: 0,
        doctor_id: null,
        revenue_head_id: null,
        cost_center_id: null,
    })

    // Void form
    const [voidReason, setVoidReason] = useState("")

    // Payment form
    const [payForm, setPayForm] = useState({
        apply_to_this_invoice: true,
        mode: "CASH",
        amount: "",
        received_at: "", // optional; backend can default now
    })

    const invStatus = String(invoice?.status || "-").toUpperCase()

    const totals = useMemo(() => {
        // accept both flat totals and nested totals
        const t = invoice?.totals || {}
        return {
            sub_total: invoice?.sub_total ?? t.sub_total ?? 0,
            discount: invoice?.discount ?? t.discount ?? 0,
            tax: invoice?.tax ?? t.tax ?? 0,
            round_off: invoice?.round_off ?? t.round_off ?? 0,
            grand_total: invoice?.grand_total ?? t.grand_total ?? 0,
        }
    }, [invoice])

    const lines = useMemo(() => invoice?._lines || [], [invoice])

    const load = async (signal) => {
        if (!can("billing.invoices.view")) return
        setLoading(true)
        try {
            // Primary: invoice detail endpoint
            const data = await getInvoice(invoiceId, { signal })
            setInvoice(normalizeInvoice(data))
        } catch (e) {
            if (isCanceledError(e)) return

            // Fallback: if backend doesn’t have GET /billing/invoices/{id}, try case invoices and find.
            try {
                const invList = await listCaseInvoices(caseId, { signal })
                const arr = Array.isArray(invList) ? invList : invList?.items ?? invList?.results ?? []
                const found = arr.find((x) => String(x.id) === String(invoiceId))
                if (!found) throw e
                setInvoice(normalizeInvoice(found))
            } catch (e2) {
                if (isCanceledError(e2)) return
                toast.error(e2?.message || e?.message || "Failed to load invoice detail")
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        load(controller.signal)
        return () => controller.abort()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, invoiceId])

    const refresh = () => {
        const controller = new AbortController()
        load(controller.signal)
    }

    const doApprove = async () => {
        try {
            await approveInvoice(invoiceId)
            toast.success("Invoice approved")
            refresh()
        } catch (e) {
            toast.error(e?.message || "Approve failed")
        }
    }

    const doPost = async () => {
        try {
            await postInvoice(invoiceId)
            toast.success("Invoice posted")
            refresh()
        } catch (e) {
            toast.error(e?.message || "Post failed")
        }
    }

    const doVoid = async () => {
        const reason = String(voidReason || "").trim()
        if (!reason) return toast.error("Enter void reason")
        try {
            await voidInvoice(invoiceId, reason)
            toast.success("Invoice voided")
            setOpenVoid(false)
            setVoidReason("")
            refresh()
        } catch (e) {
            toast.error(e?.message || "Void failed")
        }
    }

    const doAddLine = async (e) => {
        e.preventDefault()
        const qty = Number(lineForm.qty || 0)
        const unit_price = Number(lineForm.unit_price || 0)
        if (!lineForm.description?.trim()) return toast.error("Description is required")
        if (qty <= 0) return toast.error("Qty must be > 0")
        if (!(unit_price > 0)) return toast.error("Unit price must be > 0")

        try {
            await addManualLine(invoiceId, {
                ...lineForm,
                qty,
                unit_price,
                discount_amount: Number(lineForm.discount_amount || 0),
                tax_percent: Number(lineForm.tax_percent || 0),
            })
            toast.success("Line added")
            setOpenAddLine(false)
            setLineForm((s) => ({ ...s, description: "", item_code: "", unit_price: "" }))
            refresh()
        } catch (e2) {
            toast.error(e2?.message || "Add line failed")
        }
    }

    const doPay = async (e) => {
        e.preventDefault()
        const amount = Number(payForm.amount || 0)
        if (!(amount > 0)) return toast.error("Amount must be > 0")

        // If apply_to_this_invoice is false => omit invoice_id (backend auto-picks)
        const payload = {
            mode: payForm.mode,
            amount,
        }
        if (payForm.received_at) payload.received_at = payForm.received_at
        if (payForm.apply_to_this_invoice) payload.invoice_id = Number(invoiceId)

        try {
            await recordPayment(caseId, payload)
            toast.success("Payment recorded")
            setOpenPay(false)
            setPayForm((s) => ({ ...s, amount: "" }))
            refresh()
        } catch (e2) {
            // if backend returns 409: should show meaningful message
            toast.error(e2?.message || "Payment failed")
        }
    }

    const canAddLine = can("billing.invoices.lines.create")
    const canApprove = can("billing.invoices.approve")
    const canPost = can("billing.invoices.post")
    const canVoid = can("billing.invoices.void")
    const canPay = can("billing.payments.create")

    const showApprove = invStatus === "DRAFT" && canApprove
    const showPost = (invStatus === "APPROVED" || invStatus === "DRAFT") && canPost
    const showVoid = invStatus !== "VOID" && canVoid

    return (
        <div className="p-4 lg:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-2xl" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Invoice Detail</h1>
                        <p className="text-sm text-muted-foreground">
                            Case ID: {caseId} · Invoice ID: {invoiceId}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" className="rounded-2xl" onClick={refresh}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>

                    <Button variant="outline" className="rounded-2xl" disabled>
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                    </Button>
                    <Button variant="outline" className="rounded-2xl" disabled>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                    </Button>
                </div>
            </div>

            {/* Header + Actions */}
            <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
                        <span>Invoice Header</span>
                        <Badge variant="outline" className={cx("rounded-xl", statusBadge(invStatus))}>
                            {invStatus}
                        </Badge>
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    {loading ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-2xl lg:col-span-3" />
                            ))}
                        </div>
                    ) : !can("billing.invoices.view") ? (
                        <div className="text-sm text-muted-foreground">
                            You don’t have permission to view invoices.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                            <Card className="rounded-2xl lg:col-span-5">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Info</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    <div className="font-medium text-base">
                                        {invoice?.invoice_number || invoice?.number || invoice?.id}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Module: <span className="text-foreground font-medium">{invoice?.module || "-"}</span>
                                        {" · "}
                                        Type: <span className="text-foreground font-medium">{invoice?.invoice_type || "-"}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Payer Type:{" "}
                                        <span className="text-foreground font-medium">{invoice?.payer_type || "-"}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Created: <span className="text-foreground font-medium">{fmtDate(invoice?.created_at)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl lg:col-span-4">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Totals</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Sub Total</span>
                                        <span className="font-medium">{fmtMoney(totals.sub_total)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Discount</span>
                                        <span className="font-medium">{fmtMoney(totals.discount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Tax</span>
                                        <span className="font-medium">{fmtMoney(totals.tax)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Round Off</span>
                                        <span className="font-medium">{fmtMoney(totals.round_off)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Grand Total</span>
                                        <span className="font-semibold">{fmtMoney(totals.grand_total)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl lg:col-span-3">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Actions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Dialog open={openAddLine} onOpenChange={setOpenAddLine}>
                                        <DialogTrigger asChild>
                                            <Button className="w-full rounded-2xl" disabled={!canAddLine}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add Manual Line
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[720px] rounded-2xl">
                                            <DialogHeader>
                                                <DialogTitle>Add Manual Line</DialogTitle>
                                            </DialogHeader>

                                            <form onSubmit={doAddLine} className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                    <div className="md:col-span-4">
                                                        <Label>Service Group</Label>
                                                        <Select
                                                            value={lineForm.service_group}
                                                            onValueChange={(v) => setLineForm((s) => ({ ...s, service_group: v }))}
                                                        >
                                                            <SelectTrigger className="rounded-2xl">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="MISC">MISC</SelectItem>
                                                                <SelectItem value="CONSULTATION">CONSULTATION</SelectItem>
                                                                <SelectItem value="PROCEDURE">PROCEDURE</SelectItem>
                                                                <SelectItem value="LAB">LAB</SelectItem>
                                                                <SelectItem value="RIS">RIS</SelectItem>
                                                                <SelectItem value="PHARM">PHARM</SelectItem>
                                                                <SelectItem value="OT">OT</SelectItem>
                                                                <SelectItem value="IPD">IPD</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="md:col-span-4">
                                                        <Label>Item Code</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            value={lineForm.item_code}
                                                            onChange={(e) => setLineForm((s) => ({ ...s, item_code: e.target.value }))}
                                                            placeholder="Optional"
                                                        />
                                                    </div>

                                                    <div className="md:col-span-4">
                                                        <Label>Qty</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={lineForm.qty}
                                                            onChange={(e) => setLineForm((s) => ({ ...s, qty: e.target.value }))}
                                                        />
                                                    </div>

                                                    <div className="md:col-span-8">
                                                        <Label>Description</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            value={lineForm.description}
                                                            onChange={(e) => setLineForm((s) => ({ ...s, description: e.target.value }))}
                                                            placeholder="e.g., Dressing charge / Service charge"
                                                        />
                                                    </div>

                                                    <div className="md:col-span-4">
                                                        <Label>Unit Price</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={lineForm.unit_price}
                                                            onChange={(e) => setLineForm((s) => ({ ...s, unit_price: e.target.value }))}
                                                            placeholder="₹"
                                                        />
                                                    </div>

                                                    <div className="md:col-span-4">
                                                        <Label>Discount Amount</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={lineForm.discount_amount}
                                                            onChange={(e) =>
                                                                setLineForm((s) => ({ ...s, discount_amount: e.target.value }))
                                                            }
                                                        />
                                                    </div>

                                                    <div className="md:col-span-4">
                                                        <Label>Tax %</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={lineForm.tax_percent}
                                                            onChange={(e) => setLineForm((s) => ({ ...s, tax_percent: e.target.value }))}
                                                        />
                                                    </div>

                                                    <div className="md:col-span-4">
                                                        <Label>Doctor ID (optional)</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            value={lineForm.doctor_id ?? ""}
                                                            onChange={(e) =>
                                                                setLineForm((s) => ({ ...s, doctor_id: e.target.value || null }))
                                                            }
                                                            placeholder="Numeric ID"
                                                        />
                                                    </div>

                                                    <div className="md:col-span-4">
                                                        <Label>Revenue Head ID (optional)</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            value={lineForm.revenue_head_id ?? ""}
                                                            onChange={(e) =>
                                                                setLineForm((s) => ({ ...s, revenue_head_id: e.target.value || null }))
                                                            }
                                                            placeholder="Numeric ID"
                                                        />
                                                    </div>

                                                    <div className="md:col-span-4">
                                                        <Label>Cost Center ID (optional)</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            value={lineForm.cost_center_id ?? ""}
                                                            onChange={(e) =>
                                                                setLineForm((s) => ({ ...s, cost_center_id: e.target.value || null }))
                                                            }
                                                            placeholder="Numeric ID"
                                                        />
                                                    </div>
                                                </div>

                                                <DialogFooter>
                                                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setOpenAddLine(false)}>
                                                        Cancel
                                                    </Button>
                                                    <Button type="submit" className="rounded-2xl">
                                                        Add Line
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>

                                    <Button
                                        variant="outline"
                                        className="w-full rounded-2xl"
                                        onClick={doApprove}
                                        disabled={!showApprove}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Approve
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="w-full rounded-2xl"
                                        onClick={doPost}
                                        disabled={!showPost}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Post
                                    </Button>

                                    <Dialog open={openVoid} onOpenChange={setOpenVoid}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="destructive"
                                                className="w-full rounded-2xl"
                                                disabled={!showVoid}
                                            >
                                                <Ban className="h-4 w-4 mr-2" />
                                                Void
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[520px] rounded-2xl">
                                            <DialogHeader>
                                                <DialogTitle>Void Invoice</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-2">
                                                <Label>Reason</Label>
                                                <Textarea
                                                    className="rounded-2xl"
                                                    value={voidReason}
                                                    onChange={(e) => setVoidReason(e.target.value)}
                                                    placeholder="Enter reason for voiding this invoice"
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" className="rounded-2xl" onClick={() => setOpenVoid(false)}>
                                                    Cancel
                                                </Button>
                                                <Button variant="destructive" className="rounded-2xl" onClick={doVoid}>
                                                    Void Invoice
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    <Dialog open={openPay} onOpenChange={setOpenPay}>
                                        <DialogTrigger asChild>
                                            <Button className="w-full rounded-2xl" disabled={!canPay}>
                                                <BadgeIndianRupee className="h-4 w-4 mr-2" />
                                                Record Payment
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[520px] rounded-2xl">
                                            <DialogHeader>
                                                <DialogTitle>Record Payment</DialogTitle>
                                            </DialogHeader>

                                            <form onSubmit={doPay} className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Apply to</Label>
                                                    <Select
                                                        value={payForm.apply_to_this_invoice ? "THIS" : "AUTO"}
                                                        onValueChange={(v) =>
                                                            setPayForm((s) => ({ ...s, apply_to_this_invoice: v === "THIS" }))
                                                        }
                                                    >
                                                        <SelectTrigger className="rounded-2xl">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="THIS">This invoice</SelectItem>
                                                            <SelectItem value="AUTO">
                                                                Auto-pick (latest POSTED else APPROVED)
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-xs text-muted-foreground">
                                                        If you choose Auto-pick and no invoice matches, backend should return 409.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                    <div className="md:col-span-6">
                                                        <Label>Mode</Label>
                                                        <Select
                                                            value={payForm.mode}
                                                            onValueChange={(v) => setPayForm((s) => ({ ...s, mode: v }))}
                                                        >
                                                            <SelectTrigger className="rounded-2xl">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="CASH">CASH</SelectItem>
                                                                <SelectItem value="CARD">CARD</SelectItem>
                                                                <SelectItem value="UPI">UPI</SelectItem>
                                                                <SelectItem value="BANK">BANK</SelectItem>
                                                                <SelectItem value="WALLET">WALLET</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="md:col-span-6">
                                                        <Label>Amount</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={payForm.amount}
                                                            onChange={(e) => setPayForm((s) => ({ ...s, amount: e.target.value }))}
                                                            placeholder="₹"
                                                        />
                                                    </div>

                                                    <div className="md:col-span-12">
                                                        <Label>Received At (optional)</Label>
                                                        <Input
                                                            className="rounded-2xl"
                                                            value={payForm.received_at}
                                                            onChange={(e) => setPayForm((s) => ({ ...s, received_at: e.target.value }))}
                                                            placeholder="2026-01-06T10:30:00 (ISO) or leave blank"
                                                        />
                                                    </div>
                                                </div>

                                                <DialogFooter>
                                                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setOpenPay(false)}>
                                                        Cancel
                                                    </Button>
                                                    <Button type="submit" className="rounded-2xl">
                                                        Record
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Lines */}
            <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Invoice Lines</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : lines.length === 0 ? (
                        <div className="rounded-2xl border p-6 text-center">
                            <div className="text-sm font-medium">No lines</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                If your backend invoice detail doesn’t include lines yet, connect it to return lines in
                                GET /billing/invoices/{`{id}`}.
                            </div>
                        </div>
                    ) : (
                        <div className="w-full overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Service Group</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Unit</TableHead>
                                        <TableHead className="text-right">Discount</TableHead>
                                        <TableHead className="text-right">Tax</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-xs">Source</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lines.map((ln) => (
                                        <TableRow key={ln.id ?? ln.source_line_key ?? `${ln.item_code}-${ln.description}`}>
                                            <TableCell className="font-medium">{ln.service_group || "-"}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{ln.description || "-"}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {ln.item_type || "ITEM"} · {ln.item_code || "-"} · ID: {ln.item_id ?? "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">{ln.qty ?? "-"}</TableCell>
                                            <TableCell className="text-right">{fmtMoney(ln.unit_price)}</TableCell>
                                            <TableCell className="text-right">{fmtMoney(ln.discount_amount)}</TableCell>
                                            <TableCell className="text-right">
                                                {ln.tax_amount != null ? fmtMoney(ln.tax_amount) : `${ln.tax_percent ?? 0}%`}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {fmtMoney(ln.line_total ?? ln.total_amount ?? ln.net_amount)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {ln.source_module ? (
                                                    <div>
                                                        <div>{ln.source_module}</div>
                                                        <div>{ln.source_ref_id ?? "-"}</div>
                                                        <div className="truncate max-w-[180px]">{ln.source_line_key ?? "-"}</div>
                                                    </div>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
