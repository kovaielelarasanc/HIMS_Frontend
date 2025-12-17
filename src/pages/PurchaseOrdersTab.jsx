import { useEffect, useMemo, useRef, useState } from 'react'

import { toast } from 'sonner'
import {
    Plus,
    Printer,
    Mail,
    Eye,
    RefreshCcw,
    Search,
    Trash2,
    X,
    Loader2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

import {
    createPurchaseOrder,
    listPurchaseOrders,
    updatePurchaseOrder,
    changePurchaseOrderStatus,
    downloadPoPdf,
    markPoSent,
    listSuppliers,
    listLocations,
    listInventoryItems,
} from '@/api/inventory'

// --------- utils ----------
const fmtDate = (d) => {
    if (!d) return '—'
    try {
        const x = new Date(d)
        return x.toLocaleDateString()
    } catch {
        return String(d)
    }
}
const safeNum = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}
const money = (v) => safeNum(v).toFixed(2)

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
}

const STATUS_LABEL = {
    DRAFT: 'Draft',
    SENT: 'Sent',
    PARTIALLY_RECEIVED: 'Partial',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    CLOSED: 'Closed',
    APPROVED: 'Approved',
}

const STATUS_ALLOWED = {
    DRAFT: ['DRAFT', 'SENT', 'CANCELLED'],
    APPROVED: ['APPROVED', 'SENT', 'CANCELLED'],
    SENT: ['SENT', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED', 'CLOSED'],
    PARTIALLY_RECEIVED: ['PARTIALLY_RECEIVED', 'COMPLETED', 'CLOSED'],
    COMPLETED: ['COMPLETED', 'CLOSED'],
    CLOSED: ['CLOSED'],
    CANCELLED: ['CANCELLED'],
}

export default function PurchaseOrdersTab() {
    const [poLoading, setPoLoading] = useState(true)
    const [purchaseOrders, setPurchaseOrders] = useState([])

    const [suppliers, setSuppliers] = useState([])
    const [locations, setLocations] = useState([])

    const suppliersMap = useMemo(() => {
        const m = new Map()
        suppliers.forEach((s) => m.set(s.id, s))
        return m
    }, [suppliers])

    const locationsMap = useMemo(() => {
        const m = new Map()
        locations.forEach((l) => m.set(l.id, l))
        return m
    }, [locations])

    // filters
    const [q, setQ] = useState('')
    const [status, setStatus] = useState('ALL')

    // sheet
    const [poSheetOpen, setPoSheetOpen] = useState(false)
    const [editingPo, setEditingPo] = useState(null)

    // email dialog
    const [poEmailDialog, setPoEmailDialog] = useState({
        open: false,
        poId: null,
        email: '',
    })
    const [sendingMail, setSendingMail] = useState(false)

    // view dialog
    const [viewPo, setViewPo] = useState(null)

    // cancel dialog
    const [cancelDialog, setCancelDialog] = useState({
        open: false,
        poId: null,
        reason: '',
    })

    async function loadMasters() {
        try {
            const [sRes, lRes] = await Promise.all([listSuppliers(), listLocations()])
            setSuppliers(sRes.data || [])
            setLocations(lRes.data || [])
        } catch (e) {
            console.error(e)
        }
    }

    async function loadPOs() {
        setPoLoading(true)
        try {
            const params = {}
            if (status && status !== 'ALL') params.status = status
            if (q?.trim()) params.q = q.trim()
            const res = await listPurchaseOrders(params)
            setPurchaseOrders(res.data || [])
        } catch (e) {
            console.error(e)
            toast.error('Failed to load purchase orders')
        } finally {
            setPoLoading(false)
        }
    }

    useEffect(() => {
        loadMasters()
        loadPOs()
    }, [])

    const filteredPOs = useMemo(() => {
        const text = q.trim().toLowerCase()
        if (!text) return purchaseOrders
        return purchaseOrders.filter((po) => {
            const sup = po.supplier?.name || suppliersMap.get(po.supplier_id)?.name || ''
            const loc = po.location?.name || locationsMap.get(po.location_id)?.name || ''
            const s = `${po.po_number} ${sup} ${loc} ${po.status}`.toLowerCase()
            return s.includes(text)
        })
    }, [purchaseOrders, q, suppliersMap, locationsMap])

    async function handlePrintPo(po) {
        try {
            const res = await downloadPoPdf(po.id)
            downloadBlob(res.data, `PO_${po.po_number || po.id}.pdf`)
        } catch {
            toast.error('Failed to download PO PDF')
        }
    }

    async function handleChangePoStatus(poId, next) {
        try {
            await changePurchaseOrderStatus(poId, next)
            toast.success(`PO status updated: ${STATUS_LABEL[next] || next}`)
            loadPOs()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to change status')
        }
    }

    async function handleSendPoEmail() {
        if (!poEmailDialog.email?.trim()) {
            toast.error('Enter supplier email')
            return
        }
        setSendingMail(true)
        try {
            await markPoSent(poEmailDialog.poId, poEmailDialog.email.trim())
            toast.success('PO emailed & marked SENT')
            setPoEmailDialog({ open: false, poId: null, email: '' })
            loadPOs()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to send email')
        } finally {
            setSendingMail(false)
        }
    }

    function openNewPoSheet() {
        setEditingPo(null)
        setPoSheetOpen(true)
    }

    function openEditPoSheet(po) {
        setEditingPo(po)
        setPoSheetOpen(true)
    }

    function openCancel(poId) {
        setCancelDialog({ open: true, poId, reason: '' })
    }

    async function submitCancel() {
        if (!cancelDialog.reason.trim()) {
            toast.error('Cancel reason required')
            return
        }
        try {
            await changePurchaseOrderStatus(cancelDialog.poId, 'CANCELLED')
            toast.success('PO cancelled')
            setCancelDialog({ open: false, poId: null, reason: '' })
            loadPOs()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to cancel PO')
        }
    }

    return (
        <>
            <Card className="rounded-3xl border-slate-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            Purchase orders
                            <Badge variant="outline" className="text-xs">
                                {filteredPOs.length}
                            </Badge>
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                            Create POs, print PDF, email supplier, and track receipt status.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-1" onClick={loadPOs}>
                            <RefreshCcw className="w-3 h-3" />
                            Refresh
                        </Button>
                        <Button size="sm" className="gap-1" onClick={openNewPoSheet}>
                            <Plus className="w-3 h-3" />
                            New PO
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-3">
                    {/* filters */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-96">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <Input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search PO number / supplier / location..."
                                    className="pl-9 bg-white rounded-2xl"
                                    onKeyDown={(e) => e.key === 'Enter' && loadPOs()}
                                />
                            </div>
                            <Button variant="outline" size="icon" className="rounded-full" onClick={loadPOs}>
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="h-9 w-48 rounded-2xl bg-white">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All statuses</SelectItem>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="SENT">Sent</SelectItem>
                                    <SelectItem value="PARTIALLY_RECEIVED">Partially received</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                    <SelectItem value="CLOSED">Closed</SelectItem>
                                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="outline" className="rounded-2xl" onClick={loadPOs}>
                                Apply
                            </Button>
                        </div>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block border border-slate-500 rounded-2xl overflow-hidden bg-white">
                        <div className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,1.2fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                            <span>PO number</span>
                            <span>Supplier</span>
                            <span>Location / dates</span>
                            <span>Status</span>
                            <span className="text-right">Actions</span>
                        </div>

                        <div className="max-h-[440px] overflow-auto divide-y divide-slate-100">
                            {poLoading ? (
                                <div className="p-3 space-y-2">
                                    <Skeleton className="h-7 w-full" />
                                    <Skeleton className="h-7 w-full" />
                                    <Skeleton className="h-7 w-full" />
                                </div>
                            ) : filteredPOs.length === 0 ? (
                                <div className="p-4 text-sm text-slate-500">No purchase orders found.</div>
                            ) : (
                                filteredPOs.map((po) => {
                                    const sup = po.supplier || suppliersMap.get(po.supplier_id)
                                    const loc = po.location || locationsMap.get(po.location_id)
                                    const allowed = STATUS_ALLOWED[po.status] || [po.status]

                                    return (
                                        <div
                                            key={po.id}
                                            className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,1.2fr] items-center px-3 py-2 text-xs"
                                        >
                                            <div>
                                                <p className="font-medium text-slate-900">{po.po_number}</p>
                                                <p className="text-slate-500">Created: {fmtDate(po.order_date)}</p>
                                            </div>

                                            <div>
                                                <p className="text-slate-900">{sup?.name || '—'}</p>
                                                <p className="text-slate-500 text-[11px]">{sup?.phone || sup?.email || '—'}</p>
                                            </div>

                                            <div>
                                                <p className="text-slate-900">{loc?.name || '—'}</p>
                                                <p className="text-slate-500 text-[11px]">Exp: {po.expected_date ? fmtDate(po.expected_date) : '—'}</p>
                                            </div>

                                            <div>
                                                <Badge variant="outline" className="text-[10px] capitalize">
                                                    {(STATUS_LABEL[po.status] || po.status).toLowerCase()}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewPo(po)} title="View">
                                                    <Eye className="w-3 h-3" />
                                                </Button>

                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrintPo(po)} title="Print PDF">
                                                    <Printer className="w-3 h-3" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() =>
                                                        setPoEmailDialog({
                                                            open: true,
                                                            poId: po.id,
                                                            email: po.email_sent_to || sup?.email || '',
                                                        })
                                                    }
                                                    title="Email PO"
                                                >
                                                    <Mail className="w-3 h-3" />
                                                </Button>

                                                {po.status === 'DRAFT' ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 rounded-2xl text-[11px]"
                                                        onClick={() => openEditPoSheet(po)}
                                                    >
                                                        Edit
                                                    </Button>
                                                ) : null}

                                                {allowed.length > 1 && (po.status === 'DRAFT' || po.status === 'SENT') ? (
                                                    <Select
                                                        value={po.status}
                                                        onValueChange={(val) => {
                                                            if (val === 'CANCELLED') return openCancel(po.id)
                                                            handleChangePoStatus(po.id, val)
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-7 w-36 text-[11px] bg-white rounded-2xl">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {allowed.map((s) => (
                                                                <SelectItem key={s} value={s}>
                                                                    avoid
                                                                    {STATUS_LABEL[s] || s}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] capitalize">
                                                        {(STATUS_LABEL[po.status] || po.status).toLowerCase()}
                                                    </Badge>
                                                )}

                                                {po.status !== 'CANCELLED' && po.status !== 'CLOSED' ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-rose-600"
                                                        onClick={() => openCancel(po.id)}
                                                        title="Cancel"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Mobile list (cards) */}
                    <div className="sm:hidden space-y-3">
                        {poLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-20 w-full rounded-2xl" />
                                <Skeleton className="h-20 w-full rounded-2xl" />
                            </div>
                        ) : filteredPOs.length === 0 ? (
                            <div className="p-4 text-sm text-slate-500 border rounded-2xl bg-white">
                                No purchase orders found.
                            </div>
                        ) : (
                            filteredPOs.map((po) => {
                                const sup = po.supplier || suppliersMap.get(po.supplier_id)
                                const loc = po.location || locationsMap.get(po.location_id)

                                return (
                                    <div key={po.id} className="rounded-2xl border border-slate-500 bg-white p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">{po.po_number}</div>
                                                <div className="text-xs text-slate-500">
                                                    {sup?.name || '—'} • {loc?.name || '—'}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Created: {fmtDate(po.order_date)} • Exp: {po.expected_date ? fmtDate(po.expected_date) : '—'}
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] capitalize">
                                                {(STATUS_LABEL[po.status] || po.status).toLowerCase()}
                                            </Badge>
                                        </div>

                                        <div className="mt-3 flex items-center justify-end gap-2">
                                            <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => setViewPo(po)}>
                                                View
                                            </Button>
                                            <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => handlePrintPo(po)}>
                                                PDF
                                            </Button>
                                            {po.status === 'DRAFT' ? (
                                                <Button size="sm" className="rounded-2xl" onClick={() => openEditPoSheet(po)}>
                                                    Edit
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* PO Sheet (Create/Edit) */}
            <PurchaseOrderSheet
                open={poSheetOpen}
                onOpenChange={setPoSheetOpen}
                suppliers={suppliers}
                locations={locations}
                initialPo={editingPo}
                onSaved={() => {
                    setPoSheetOpen(false)
                    setEditingPo(null)
                    loadPOs()
                }}
            />

            {/* Email Dialog */}
            <Dialog open={poEmailDialog.open} onOpenChange={(v) => setPoEmailDialog((p) => ({ ...p, open: v }))}>
                <DialogContent className="rounded-3xl max-w-md">
                    <DialogHeader>
                        <DialogTitle>Email Purchase Order</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label>Supplier email</Label>
                        <Input
                            value={poEmailDialog.email}
                            onChange={(e) => setPoEmailDialog((p) => ({ ...p, email: e.target.value }))}
                            placeholder="supplier@email.com"
                            className="rounded-2xl bg-white"
                        />
                        <p className="text-xs text-slate-500">
                            This will send PO PDF and mark status as <b>SENT</b>.
                        </p>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => setPoEmailDialog({ open: false, poId: null, email: '' })}
                            disabled={sendingMail}
                        >
                            Cancel
                        </Button>
                        <Button className="rounded-2xl" onClick={handleSendPoEmail} disabled={sendingMail}>
                            {sendingMail ? 'Sending…' : 'Send'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancel Reason Dialog */}
            <Dialog open={cancelDialog.open} onOpenChange={(v) => setCancelDialog((p) => ({ ...p, open: v }))}>
                <DialogContent className="rounded-3xl max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancel PO</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label>Reason</Label>
                        <Textarea
                            value={cancelDialog.reason}
                            onChange={(e) => setCancelDialog((p) => ({ ...p, reason: e.target.value }))}
                            placeholder="Enter cancel reason…"
                            className="rounded-2xl bg-white"
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="rounded-2xl" onClick={() => setCancelDialog({ open: false, poId: null, reason: '' })}>
                            Close
                        </Button>
                        <Button className="rounded-2xl" onClick={submitCancel}>
                            Cancel PO
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={!!viewPo} onOpenChange={(v) => !v && setViewPo(null)}>
                <DialogContent className="rounded-3xl max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>PO Details</span>
                            <Badge variant="outline" className="text-xs">
                                {viewPo?.po_number}
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-2 sm:grid-cols-3 text-xs">
                        <div>
                            <div className="text-slate-500">Supplier</div>
                            <div className="text-slate-900 font-medium">
                                {viewPo?.supplier?.name || suppliersMap.get(viewPo?.supplier_id)?.name || '—'}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500">Location</div>
                            <div className="text-slate-900 font-medium">
                                {viewPo?.location?.name || locationsMap.get(viewPo?.location_id)?.name || '—'}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500">Dates</div>
                            <div className="text-slate-900">
                                Order: {fmtDate(viewPo?.order_date)} <br />
                                Expected: {fmtDate(viewPo?.expected_date)}
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="border rounded-2xl overflow-hidden">
                        <div className="grid grid-cols-[1.2fr,0.6fr,0.6fr,0.6fr] bg-slate-50 text-xs font-semibold text-slate-500 px-3 py-2">
                            <span>Item</span>
                            <span className="text-right">Qty</span>
                            <span className="text-right">Rate</span>
                            <span className="text-right">Total</span>
                        </div>
                        <div className="max-h-72 overflow-auto divide-y">
                            {(viewPo?.items || []).length === 0 ? (
                                <div className="p-3 text-sm text-slate-500">No items</div>
                            ) : (
                                (viewPo?.items || []).map((li) => {
                                    const qty = safeNum(li.ordered_qty)
                                    const rate = safeNum(li.unit_cost)
                                    const total = safeNum(li.line_total || qty * rate)

                                    return (
                                        <div key={li.id} className="grid grid-cols-[1.2fr,0.6fr,0.6fr,0.6fr] px-3 py-2 text-xs">
                                            <div className="text-slate-900">
                                                {li.item?.name || li.item_name || `Item #${li.item_id}`}
                                            </div>
                                            <div className="text-right text-slate-700">{qty}</div>
                                            <div className="text-right text-slate-700">{money(rate)}</div>
                                            <div className="text-right text-slate-900 font-medium">{money(total)}</div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="rounded-2xl" onClick={() => setViewPo(null)}>
                            Close
                        </Button>
                        {viewPo?.id ? (
                            <Button className="rounded-2xl" onClick={() => handlePrintPo(viewPo)}>
                                Print PDF
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

/* -------------------- NEW USER-FRIENDLY PO SHEET -------------------- */
function PurchaseOrderSheet({ open, onOpenChange, suppliers, locations, initialPo, onSaved }) {
    const isEdit = !!initialPo?.id

    const [saving, setSaving] = useState(false)

    // header
    const [supplierId, setSupplierId] = useState('')
    const [locationId, setLocationId] = useState('')
    const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
    const [expectedDate, setExpectedDate] = useState('')
    const [notes, setNotes] = useState('')

    // search
    const [itemQuery, setItemQuery] = useState('')
    const [itemResults, setItemResults] = useState([])
    const [searching, setSearching] = useState(false)

    // lines
    const [lines, setLines] = useState([])
    const [lastAddedKey, setLastAddedKey] = useState(null)

    const scrollRef = useRef(null)
    const rowRefs = useRef({})

    const safeNum = (v) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : 0
    }
    const money = (v) => safeNum(v).toFixed(2)

    useEffect(() => {
        if (!open) return

        setSupplierId(initialPo?.supplier_id ? String(initialPo.supplier_id) : '')
        setLocationId(initialPo?.location_id ? String(initialPo.location_id) : '')
        setOrderDate(initialPo?.order_date || new Date().toISOString().slice(0, 10))
        setExpectedDate(initialPo?.expected_date || '')
        setNotes(initialPo?.notes || '')

        const src = initialPo?.items || []
        setLines(
            src.map((li) => ({
                key: `${li.id || li.item_id}-${Math.random().toString(16).slice(2)}`,
                item_id: li.item_id,
                item_name: li.item?.name || li.item_name || '',
                item_code: li.item?.code || li.item_code || '',
                ordered_qty: li.ordered_qty ?? 1,
                unit_cost: li.unit_cost ?? 0,
                tax_percent: li.tax_percent ?? 0,
                mrp: li.mrp ?? 0,
                remarks: li.remarks || '',
            }))
        )

        setItemQuery('')
        setItemResults([])
        setLastAddedKey(null)
    }, [open, initialPo])

    useEffect(() => {
        if (!lastAddedKey) return
        const el = rowRefs.current[lastAddedKey]
        if (el?.scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [lastAddedKey])

    const totals = useMemo(() => {
        const sub = lines.reduce((acc, l) => acc + safeNum(l.ordered_qty) * safeNum(l.unit_cost), 0)
        const tax = lines.reduce((acc, l) => {
            const base = safeNum(l.ordered_qty) * safeNum(l.unit_cost)
            return acc + base * (safeNum(l.tax_percent) / 100)
        }, 0)
        return { sub, tax, grand: sub + tax }
    }, [lines])

    const canSave = useMemo(() => {
        if (!supplierId || !locationId) return false
        if (!lines.length) return false
        for (const l of lines) {
            if (!l.item_id) return false
            if (safeNum(l.ordered_qty) <= 0) return false
        }
        return true
    }, [supplierId, locationId, lines])

    let searchTimer = useRef(null)

    async function doSearch(text) {
        if (!text || text.length < 2) {
            setItemResults([])
            return
        }
        setSearching(true)
        try {
            const res = await listInventoryItems({ q: text, limit: 20 })
            setItemResults(res.data || [])
        } catch (e) {
            console.error(e)
            setItemResults([])
        } finally {
            setSearching(false)
        }
    }

    function onChangeQuery(v) {
        setItemQuery(v)
        if (searchTimer.current) clearTimeout(searchTimer.current)
        searchTimer.current = setTimeout(() => doSearch(v.trim()), 250)
    }

    function addItemRow(item) {
        if (!item?.id) return
        if (lines.some((l) => l.item_id === item.id)) {
            toast.warning('Item already added')
            return
        }

        const key = `${item.id}-${Date.now()}`
        setLines((prev) => [
            ...prev,
            {
                key,
                item_id: item.id,
                item_name: item.name,
                item_code: item.code,
                ordered_qty: 1,
                unit_cost: item.default_price ?? 0,
                tax_percent: item.default_tax_percent ?? 0,
                mrp: item.default_mrp ?? 0,
                remarks: '',
            },
        ])
        setLastAddedKey(key)
        setItemQuery('')
        setItemResults([])
    }

    function updateLine(key, patch) {
        setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
    }

    function removeLine(key) {
        setLines((prev) => prev.filter((l) => l.key !== key))
    }

    async function savePo() {
        if (!supplierId) return toast.error('Select supplier')
        if (!locationId) return toast.error('Select location')
        if (!lines.length) return toast.error('Add at least 1 item')

        for (const l of lines) {
            if (!l.item_id) return toast.error('Invalid item in lines')
            if (safeNum(l.ordered_qty) <= 0) return toast.error('Qty must be > 0')
        }

        const payload = {
            supplier_id: Number(supplierId),
            location_id: Number(locationId),
            order_date: orderDate || null,
            expected_date: expectedDate || null,
            notes: notes || '',
            items: lines.map((l) => ({
                item_id: l.item_id,
                ordered_qty: String(l.ordered_qty ?? 0),
                unit_cost: String(l.unit_cost ?? 0),
                tax_percent: String(l.tax_percent ?? 0),
                mrp: String(l.mrp ?? 0),
                remarks: l.remarks || '',
            })),
        }

        setSaving(true)
        try {
            if (isEdit) {
                await updatePurchaseOrder(initialPo.id, payload)
                toast.success('PO updated')
            } else {
                await createPurchaseOrder(payload)
                toast.success('PO created')
            }
            onSaved?.()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to save PO')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-screen sm:w-[980px] max-w-none sm:max-w-none p-0 overflow-hidden"
            >
                <div className="h-full flex flex-col">
                    {/* HEADER */}
                    <div className="border-b bg-white p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-slate-900">
                                    {isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Simple and clear: Supplier → Location → Items. GRN confirms invoice & batches.
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                className="rounded-2xl"
                                onClick={() => onOpenChange(false)}
                                disabled={saving}
                            >
                                Close
                            </Button>
                        </div>
                    </div>

                    {/* BODY */}
                    <div ref={scrollRef} className="flex-1 overflow-auto p-5 space-y-4 bg-slate-50">
                        {/* TOP DETAILS (more free space) */}
                        <div className="rounded-3xl border border-slate-500 bg-white p-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Supplier</Label>
                                    <select
                                        className="h-11 w-full rounded-2xl border border-slate-500 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                        value={supplierId}
                                        onChange={(e) => setSupplierId(e.target.value)}
                                    >
                                        <option value="">Select supplier</option>
                                        {suppliers.map((s) => (
                                            <option key={s.id} value={String(s.id)}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Receiving location</Label>
                                    <select
                                        className="h-11 w-full rounded-2xl border border-slate-500 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                        value={locationId}
                                        onChange={(e) => setLocationId(e.target.value)}
                                    >
                                        <option value="">Select location</option>
                                        {locations.map((l) => (
                                            <option key={l.id} value={String(l.id)}>
                                                {l.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Order date</Label>
                                    <Input
                                        type="date"
                                        className="h-11 rounded-2xl bg-white"
                                        value={orderDate}
                                        onChange={(e) => setOrderDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Expected date</Label>
                                    <Input
                                        type="date"
                                        className="h-11 rounded-2xl bg-white"
                                        value={expectedDate || ''}
                                        onChange={(e) => setExpectedDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mt-3 space-y-1.5">
                                <Label>Notes</Label>
                                <Textarea
                                    className="rounded-2xl bg-white"
                                    placeholder="Optional instructions for supplier…"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* ITEMS */}
                        <div className="rounded-3xl border border-slate-500 bg-white">
                            {/* Sticky add bar (always visible) */}
                            <div className="sticky top-0 z-30 bg-white rounded-t-3xl border-b border-slate-500 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Add items</div>
                                        <div className="text-xs text-slate-500">
                                            Search and click item to add. Qty is visible and editable.
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        {lines.length} items
                                    </Badge>
                                </div>

                                <div className="mt-3 relative">
                                    <div className="flex gap-2">
                                        <Input
                                            className="h-11 rounded-2xl bg-white"
                                            placeholder="Search item name / code / generic… (min 2 chars)"
                                            value={itemQuery}
                                            onChange={(e) => onChangeQuery(e.target.value)}
                                        />
                                        <Button
                                            variant="outline"
                                            className="rounded-2xl h-11"
                                            onClick={() => doSearch(itemQuery.trim())}
                                            disabled={searching || itemQuery.trim().length < 2}
                                        >
                                            {searching ? 'Searching…' : 'Search'}
                                        </Button>
                                    </div>

                                    {/* Dropdown results */}
                                    {itemResults.length > 0 ? (
                                        <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-slate-500 bg-white shadow-lg overflow-hidden z-50">
                                            <div className="max-h-72 overflow-auto divide-y">
                                                {itemResults.map((it) => (
                                                    <button
                                                        key={it.id}
                                                        type="button"
                                                        onClick={() => addItemRow(it)}
                                                        className="w-full text-left px-3 py-3 hover:bg-slate-50"
                                                    >
                                                        <div className="text-sm font-semibold text-slate-900">{it.name}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {it.code} {it.generic_name ? `• ${it.generic_name}` : ''} • Default ₹{money(it.default_price)}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Desktop table (Qty always visible) */}
                            <div className="hidden sm:block p-4">
                                {lines.length === 0 ? (
                                    <div className="text-sm text-slate-500 py-10 text-center">
                                        No items added yet. Use the search box above.
                                    </div>
                                ) : (
                                    <div className="border border-slate-500 rounded-2xl overflow-hidden">
                                        <div className="grid grid-cols-[2.2fr,0.9fr,0.9fr,0.8fr,1fr,0.5fr] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                            <div>Item</div>
                                            <div className="text-right">Qty</div>
                                            <div className="text-right">Rate</div>
                                            <div className="text-right">Tax %</div>
                                            <div className="text-right">Est total</div>
                                            <div className="text-right">Remove</div>
                                        </div>

                                        <div className="divide-y">
                                            {lines.map((l) => {
                                                const base = safeNum(l.ordered_qty) * safeNum(l.unit_cost)
                                                const tax = base * (safeNum(l.tax_percent) / 100)
                                                const est = base + tax

                                                return (
                                                    <div
                                                        key={l.key}
                                                        ref={(el) => (rowRefs.current[l.key] = el)}
                                                        className={`grid grid-cols-[2.2fr,0.9fr,0.9fr,0.8fr,1fr,0.5fr] items-center gap-2 px-3 py-3 ${lastAddedKey === l.key ? 'bg-emerald-50/40' : 'bg-white'
                                                            }`}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-semibold text-slate-900 truncate">{l.item_name}</div>
                                                            <div className="text-xs text-slate-500 truncate">{l.item_code}</div>
                                                            <Input
                                                                className="mt-2 h-9 rounded-2xl bg-white text-sm"
                                                                placeholder="Remarks (optional)"
                                                                value={l.remarks}
                                                                onChange={(e) => updateLine(l.key, { remarks: e.target.value })}
                                                            />
                                                        </div>

                                                        <Input
                                                            className="h-10 rounded-2xl bg-white text-right font-semibold"
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={l.ordered_qty}
                                                            onChange={(e) => updateLine(l.key, { ordered_qty: e.target.value })}
                                                        />
                                                        <Input
                                                            className="h-10 rounded-2xl bg-white text-right"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={l.unit_cost}
                                                            onChange={(e) => updateLine(l.key, { unit_cost: e.target.value })}
                                                        />
                                                        <Input
                                                            className="h-10 rounded-2xl bg-white text-right"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={l.tax_percent}
                                                            onChange={(e) => updateLine(l.key, { tax_percent: e.target.value })}
                                                        />

                                                        <div className="text-right font-semibold text-slate-900">₹{money(est)}</div>

                                                        <div className="flex justify-end">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="rounded-full"
                                                                onClick={() => removeLine(l.key)}
                                                            >
                                                                <Trash2 className="w-4 h-4 text-rose-600" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Mobile cards */}
                            <div className="sm:hidden p-4 space-y-3">
                                {lines.length === 0 ? (
                                    <div className="text-sm text-slate-500 py-8 text-center">
                                        No items added yet. Use the search box above.
                                    </div>
                                ) : (
                                    lines.map((l) => {
                                        const base = safeNum(l.ordered_qty) * safeNum(l.unit_cost)
                                        const tax = base * (safeNum(l.tax_percent) / 100)
                                        const est = base + tax

                                        return (
                                            <div
                                                key={l.key}
                                                ref={(el) => (rowRefs.current[l.key] = el)}
                                                className={`rounded-2xl border border-slate-500 p-3 ${lastAddedKey === l.key ? 'bg-emerald-50/40' : 'bg-white'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-slate-900 truncate">{l.item_name}</div>
                                                        <div className="text-xs text-slate-500 truncate">{l.item_code}</div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => removeLine(l.key)}>
                                                        <Trash2 className="w-4 h-4 text-rose-600" />
                                                    </Button>
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px]">Qty</Label>
                                                        <Input
                                                            className="h-11 rounded-2xl bg-white font-semibold"
                                                            type="number"
                                                            step="1"
                                                            value={l.ordered_qty}
                                                            onChange={(e) => updateLine(l.key, { ordered_qty: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px]">Rate</Label>
                                                        <Input
                                                            className="h-11 rounded-2xl bg-white"
                                                            type="number"
                                                            step="0.01"
                                                            value={l.unit_cost}
                                                            onChange={(e) => updateLine(l.key, { unit_cost: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px]">Tax %</Label>
                                                        <Input
                                                            className="h-11 rounded-2xl bg-white"
                                                            type="number"
                                                            step="0.01"
                                                            value={l.tax_percent}
                                                            onChange={(e) => updateLine(l.key, { tax_percent: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px]">Est total</Label>
                                                        <div className="h-11 rounded-2xl border border-slate-500 bg-slate-50 px-3 flex items-center font-semibold">
                                                            ₹{money(est)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <Input
                                                        className="h-11 rounded-2xl bg-white"
                                                        placeholder="Remarks (optional)"
                                                        value={l.remarks}
                                                        onChange={(e) => updateLine(l.key, { remarks: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* FOOTER (always visible) */}
                    <div className="border-t bg-white p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-600">
                                <div>
                                    Subtotal: <span className="font-semibold text-slate-900">₹{money(totals.sub)}</span>
                                </div>
                                <div>
                                    Tax (est): <span className="font-semibold text-slate-900">₹{money(totals.tax)}</span>
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">
                                    Grand: ₹{money(totals.grand)}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-2xl"
                                    onClick={() => onOpenChange(false)}
                                    disabled={saving}
                                >
                                    Close
                                </Button>
                                <Button className="rounded-2xl" onClick={savePo} disabled={!canSave || saving}>
                                    {saving ? 'Saving…' : isEdit ? 'Update PO' : 'Create PO'}
                                </Button>
                            </div>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-2">
                            Note: GRN will confirm actual invoice values and batch-wise price/tax.
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

