// FILE: src/pages/InventoryPharmacy.jsx
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Copy, ScanLine } from 'lucide-react'

// FILE: src/pages/InventoryPharmacy.jsx
import {
    listInventoryLocations,
    listSuppliers,
    listInventoryItems,
    createInventoryItem,
    updateInventoryItem,
    downloadItemsSampleCsv,
    bulkUploadItemsCsv,
    getStockSummary,
    getExpiryAlerts,
    getExpiredAlerts,       // NEW
    getQuarantineStock,     // NEW
    getLowStockAlerts,
    getMaxStockAlerts,
    listPurchaseOrders,
    createPurchaseOrder,
    changePurchaseOrderStatus,
    downloadPoPdf,
    markPoSent,
    listGrns,
    createGrn,
    postGrn,
    listReturnNotes,
    createReturnNote,
    postReturnNote,         // NEW
    listStockTransactions,
    createInventoryLocation,
    updateInventoryLocation,
    createSupplier,
    updateSupplier,
    getGrn
} from '../api/inventory'


import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select'

import { Skeleton } from '@/components/ui/skeleton'

import {
    Pill,
    PackageOpen,
    AlertTriangle,
    Truck,
    ClipboardList,
    RefreshCcw,
    Upload,
    Download,
    Filter,
    Eye,
    Printer,
    Mail,
    Plus,
    Activity,
    ShieldAlert,            // NEW
} from 'lucide-react'


// -------- helpers --------
function formatDate(iso) {
    if (!iso) return ''
    try {
        return new Date(iso).toLocaleDateString()
    } catch {
        return iso
    }
}

function formatNumber(v) {
    if (v == null) return '0'
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// -------- main --------
export default function InventoryPharmacy() {
    const [tab, setTab] = useState('dashboard')

    // masters
    const [locations, setLocations] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [items, setItems] = useState([])
    const [itemsLoading, setItemsLoading] = useState(false)

    // stock & alerts
    // stock & alerts
    const [stock, setStock] = useState([])
    const [expiryAlerts, setExpiryAlerts] = useState([])
    const [expiredAlerts, setExpiredAlerts] = useState([])          // NEW
    const [quarantineStock, setQuarantineStock] = useState([])      // NEW
    const [lowStock, setLowStock] = useState([])
    const [maxStock, setMaxStock] = useState([])
    const [stockLoading, setStockLoading] = useState(false)

    const [postReason, setPostReason] = useState({})
    // PO, GRN, Returns, Txns
    const [purchaseOrders, setPurchaseOrders] = useState([])
    const [poLoading, setPoLoading] = useState(false)
    const [grns, setGrns] = useState([])
    const [grnLoading, setGrnLoading] = useState(false)
    const [returns, setReturns] = useState([])
    const [returnLoading, setReturnLoading] = useState(false)
    const [txns, setTxns] = useState([])
    const [txnLoading, setTxnLoading] = useState(false)

    // filters
    // filters
    const [activeLocationId, setActiveLocationId] = useState('ALL')
    const [itemSearch, setItemSearch] = useState('')
    const [stockView, setStockView] = useState('saleable')          // NEW


    // dialogs / sheets
    const [itemDialogOpen, setItemDialogOpen] = useState(false)
    const [editItem, setEditItem] = useState(null)

    const [csvDialogOpen, setCsvDialogOpen] = useState(false)

    const [poSheetOpen, setPoSheetOpen] = useState(false)
    const [newPoLines, setNewPoLines] = useState([])
    const [poForm, setPoForm] = useState({
        supplier_id: '',
        location_id: '',
        expected_date: '',
        notes: '',
    })
    const [poEmailDialog, setPoEmailDialog] = useState({
        open: false,
        poId: null,
        email: '',
    })

    const [grnSheetOpen, setGrnSheetOpen] = useState(false)
    const [grnForm, setGrnForm] = useState({
        supplier_id: '',
        location_id: '',
        po_id: '',

        received_date: new Date().toISOString().slice(0, 10),

        invoice_number: '',
        invoice_date: '',

        supplier_invoice_amount: '',
        freight_amount: '',
        other_charges: '',
        round_off: '',
        difference_reason: '',

        notes: '',
    })
    const [grnLines, setGrnLines] = useState([])

    const [returnSheetOpen, setReturnSheetOpen] = useState(false)
    const [returnForm, setReturnForm] = useState({
        type: 'TO_SUPPLIER',
        supplier_id: '',
        location_id: '',
        reason: '',
    })
    const [returnLines, setReturnLines] = useState([])
    const [postModal, setPostModal] = useState({
        open: false,
        grn: null,
        reason: '',
        posting: false,
    })
    // location & supplier master dialogs
    const [locationDialogOpen, setLocationDialogOpen] = useState(false)
    const [editLocation, setEditLocation] = useState(null)

    const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
    const [editSupplier, setEditSupplier] = useState(null)

    const [grnQuery, setGrnQuery] = useState('')
    const [grnStatus, setGrnStatus] = useState('ALL')

    const n = (v) => {
        if (v === '' || v === null || v === undefined) return 0
        const x = Number(v)
        return Number.isFinite(x) ? x : 0
    }

    const s = (v) => (v == null ? '' : String(v))

    const d = (v) => (v ? String(v) : null) // date or null

    const filteredGrns = useMemo(() => {
        const q = (grnQuery || '').toLowerCase().trim()
        return (grns || []).filter((g) => {
            const okStatus = grnStatus === 'ALL' ? true : (String(g.status || 'DRAFT') === grnStatus)
            if (!okStatus) return false
            if (!q) return true
            const hay = [
                g.grn_number,
                g.invoice_number,
                g.supplier?.name,
                g.location?.name,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
            return hay.includes(q)
        })
    }, [grns, grnQuery, grnStatus])


    const [grnView, setGrnView] = useState({
        open: false,
        loading: false,
        data: null,
    })

    async function openGrnPreview(grn) {
        const id = grn?.id
        if (!id) return

        setGrnView({ open: true, loading: true, data: null })
        try {
            const res = await getGrn(id)
            setGrnView({ open: true, loading: false, data: res?.data || null })
        } catch (e) {
            setGrnView({ open: false, loading: false, data: null })
            console.log('GET GRN error:', {
                status: e?.response?.status,
                data: e?.response?.data,
                url: e?.config?.url,
            })

            toast.error('Failed to load GRN', {
                description: e?.response?.data?.detail || `HTTP ${e?.response?.status || ''}` || 'Please try again.',
            })
        }
    }


    const hasMismatch = (grn) => {
        const diff = Number(grn?.amount_difference || 0)
        return Math.abs(diff) >= 0.01
    }

    const onClickPost = (grn) => {
        if (!grn?.id) return

        if (hasMismatch(grn)) {
            setPostModal({
                open: true,
                grn,
                reason: grn?.difference_reason || '',
                posting: false,
            })
        } else {
            handlePostGrn(grn.id, '') // no reason needed
        }
    }

    const handleCopyBarcode = (value) => {
        if (!value) return
        if (!navigator.clipboard) {
            console.warn('Clipboard API not available')
            return
        }
        navigator.clipboard.writeText(value)
            .then(() => toast.success('Barcode copied'))
            .catch(() => toast.error('Unable to copy barcode'))
    }

    // -------- load masters & core data --------
    useEffect(() => {
        loadMasters()
        refreshAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function refreshAll() {
        loadItems()
        loadStock()
        loadPurchaseOrders()
        loadGrns()
        loadReturns()
        loadTransactions()
    }

    async function loadMasters() {
        try {
            const [locRes, supRes] = await Promise.all([
                listInventoryLocations(),
                listSuppliers(),
            ])
            setLocations(locRes.data || [])
            setSuppliers(supRes.data || [])
        } catch (err) {
            console.error(err)
        }
    }

    async function loadItems() {
        setItemsLoading(true)
        try {
            const res = await listInventoryItems({
                q: itemSearch || undefined,
                is_active: true,
            })
            setItems(res.data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setItemsLoading(false)
        }
    }

    async function loadStock() {
        setStockLoading(true)
        const params =
            activeLocationId && activeLocationId !== 'ALL'
                ? { location_id: activeLocationId }
                : {}
        try {
            const [
                stockRes,
                expRes,
                expiredRes,
                quarantineRes,
                lowRes,
                maxRes,
            ] = await Promise.all([
                getStockSummary(params),
                getExpiryAlerts(params),
                getExpiredAlerts(params),
                getQuarantineStock(params),
                getLowStockAlerts(params),
                getMaxStockAlerts(params),
            ])
            setStock(stockRes.data || [])
            setExpiryAlerts(expRes.data || [])
            setExpiredAlerts(expiredRes.data || [])
            setQuarantineStock(quarantineRes.data || [])
            setLowStock(lowRes.data || [])
            setMaxStock(maxRes.data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setStockLoading(false)
        }
    }


    async function loadPurchaseOrders() {
        setPoLoading(true)
        try {
            const res = await listPurchaseOrders({})
            setPurchaseOrders(res.data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setPoLoading(false)
        }
    }

    async function loadGrns() {
        setGrnLoading(true)
        try {
            const res = await listGrns({})
            console.log("==============================");
            console.log(JSON.stringify(res.data));
            console.log("==============================");
            setGrns(res.data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setGrnLoading(false)
        }
    }

    async function loadReturns() {
        setReturnLoading(true)
        try {
            const res = await listReturnNotes({})
            setReturns(res.data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setReturnLoading(false)
        }
    }

    async function loadTransactions() {
        setTxnLoading(true)
        try {
            const res = await listStockTransactions({})
            setTxns(res.data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setTxnLoading(false)
        }
    }

    // -------- dashboard metrics --------
    const totalActiveItems = useMemo(() => items.length, [items])
    const totalBatchesNearExpiry = useMemo(
        () => expiryAlerts.length,
        [expiryAlerts]
    )
    const totalLowStockItems = useMemo(
        () => lowStock.length,
        [lowStock]
    )
    const totalExpiredOnShelf = useMemo(
        () => expiredAlerts.length,
        [expiredAlerts]
    )
    const totalQuarantineBatches = useMemo(
        () => quarantineStock.length,
        [quarantineStock]
    )

    const totalPoOpen = useMemo(
        () =>
            purchaseOrders.filter(
                po =>
                    po.status !== 'COMPLETED' &&
                    po.status !== 'CANCELLED' &&
                    po.status !== 'CLOSED'
            ).length,
        [purchaseOrders]
    )

    // -------- item create / edit --------
    function openNewItemDialog() {
        setEditItem(null)
        setItemDialogOpen(true)
    }

    function openEditItemDialog(item) {
        setEditItem(item)
        setItemDialogOpen(true)
    }

    const handleSaveItem = async (e) => {
        e.preventDefault()
        const form = e.currentTarget   // safer than e.target

        const payload = {
            code: form.code.value.trim(),
            name: form.name.value.trim(),
            generic_name: form.generic_name.value.trim() || null,
            form: form.form.value.trim() || null,
            strength: form.strength.value.trim() || null,
            unit: form.unit.value.trim() || 'tablet',
            pack_size: form.pack_size.value || '10',
            manufacturer: form.manufacturer.value.trim() || null,
            default_price: form.default_price.value || null,
            default_mrp: form.default_mrp.value || null,
            default_tax_percent: form.default_tax_percent.value || null,
            reorder_level: form.reorder_level.value || null,
            max_level: form.max_level.value || null,
            class_name: form.class_name.value.trim() || null,
            atc_code: form.atc_code.value.trim() || null,
            hsn_code: form.hsn_code.value.trim() || null,
            is_consumable: form.is_consumable.checked,
            lasa_flag: form.lasa_flag.checked,
        }

        const qrNumber = form.qr_number?.value?.trim()
        if (qrNumber) {
            payload.qr_number = qrNumber   // send as barcode
        }

        try {
            if (editItem?.id) {
                await updateInventoryItem(editItem.id, payload)
                toast.success('Item updated')
            } else {
                await createInventoryItem(payload)
                toast.success('Item created')
            }

            setItemDialogOpen(false)
            form.reset()

            // refresh item list & stock
            await Promise.all([loadItems(), loadStock()])
        } catch (err) {
            console.error('Failed to save item', err)
            // axios interceptor will show error toast
        }
    }


    // -------- location create / edit --------
    function openNewLocationDialog() {
        setEditLocation(null)
        setLocationDialogOpen(true)
    }

    function openEditLocationDialog(loc) {
        setEditLocation(loc)
        setLocationDialogOpen(true)
    }

    async function handleSaveLocation(e) {
        e.preventDefault()
        const form = new FormData(e.target)
        const payload = {
            code: form.get('code') || '',
            name: form.get('name') || '',
            description: form.get('description') || '',
            is_active: true,
        }

        if (!payload.name) {
            toast.error('Location name is required')
            return
        }

        try {
            if (editLocation) {
                await updateInventoryLocation(editLocation.id, payload)
                toast.success('Location updated')
            } else {
                await createInventoryLocation(payload)
                toast.success('Location created')
            }
            setLocationDialogOpen(false)
            setEditLocation(null)
            await loadMasters()
            await loadStock()
        } catch (err) {
            console.error(err)
        }
    }

    // -------- supplier create / edit --------
    function openNewSupplierDialog() {
        setEditSupplier(null)
        setSupplierDialogOpen(true)
    }

    function openEditSupplierDialog(s) {
        setEditSupplier(s)
        setSupplierDialogOpen(true)
    }

    async function handleSaveSupplier(e) {
        e.preventDefault()
        const form = new FormData(e.target)
        const payload = {
            code: form.get('code') || '',
            name: form.get('name') || '',
            contact_person: form.get('contact_person') || '',
            phone: form.get('phone') || '',
            email: form.get('email') || '',
            gst_number: form.get('gst_number') || '',
            address: form.get('address') || '',
            is_active: true,
        }

        if (!payload.name) {
            toast.error('Supplier name is required')
            return
        }

        try {
            if (editSupplier) {
                await updateSupplier(editSupplier.id, payload)
                toast.success('Supplier updated')
            } else {
                await createSupplier(payload)
                toast.success('Supplier created')
            }
            setSupplierDialogOpen(false)
            setEditSupplier(null)
            await loadMasters()
            await loadPurchaseOrders()
            await loadGrns()
            await loadReturns()
        } catch (err) {
            console.error(err)
        }
    }

    // -------- CSV --------
    async function handleDownloadSampleCsv() {
        try {
            const res = await downloadItemsSampleCsv()
            const blob = new Blob([res.data], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'pharmacy_items_sample.csv'
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error(err)
        }
    }

    async function handleUploadCsv(e) {
        e.preventDefault()
        const file = e.target.file?.files?.[0]
        if (!file) {
            toast.error('Please choose a CSV file')
            return
        }
        try {
            const res = await bulkUploadItemsCsv(file)
            toast.success(
                `Items uploaded – created: ${res.data.created}, updated: ${res.data.updated}`
            )
            setCsvDialogOpen(false)
            loadItems()
            loadStock()
        } catch (err) {
            console.error(err)
        }
    }

    // -------- PO --------
    function addPoLine() {
        setNewPoLines(ls => [
            ...ls,
            {
                item_id: '',
                ordered_qty: 1,
                unit_cost: 0,
                tax_percent: 0,
                mrp: 0,
            },
        ])
    }

    function updatePoLine(idx, field, value) {
        setNewPoLines(ls =>
            ls.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
        )
    }

    function removePoLine(idx) {
        setNewPoLines(ls => ls.filter((_, i) => i !== idx))
    }

    async function handleCreatePo(e) {
        e.preventDefault()
        if (!poForm.supplier_id || !poForm.location_id || newPoLines.length === 0) {
            toast.error('Supplier, location and at least one line are required')
            return
        }

        const payload = {
            supplier_id: Number(poForm.supplier_id),
            location_id: Number(poForm.location_id),
            order_date: new Date().toISOString().slice(0, 10),
            expected_date: poForm.expected_date || null,
            notes: poForm.notes || '',
            items: newPoLines
                .filter(l => l.item_id)
                .map(l => ({
                    item_id: Number(l.item_id),
                    ordered_qty: Number(l.ordered_qty || 0),
                    unit_cost: Number(l.unit_cost || 0),
                    tax_percent: Number(l.tax_percent || 0),
                    mrp: Number(l.mrp || 0),
                })),
        }

        if (payload.items.length === 0) {
            toast.error('Add at least one valid line')
            return
        }

        try {
            await createPurchaseOrder(payload)
            toast.success('Purchase order created')
            setPoSheetOpen(false)
            setNewPoLines([])
            setPoForm({
                supplier_id: '',
                location_id: '',
                expected_date: '',
                notes: '',
            })
            loadPurchaseOrders()
        } catch (err) {
            console.error(err)
        }
    }

    async function handleChangePoStatus(poId, status) {
        try {
            await changePurchaseOrderStatus(poId, status)
            toast.success(`PO marked as ${status}`)
            loadPurchaseOrders()
        } catch (err) {
            console.error(err)
        }
    }

    async function handlePrintPo(poId) {
        try {
            const res = await downloadPoPdf(poId)
            const blob = new Blob([res.data], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
            setTimeout(() => URL.revokeObjectURL(url), 10000)
        } catch (err) {
            console.error(err)
        }
    }

    async function handleMarkPoSent(e) {
        e.preventDefault()
        const { poId, email } = poEmailDialog
        if (!email) {
            toast.error('Email is required')
            return
        }
        try {
            await markPoSent(poId, email)
            toast.success('PO marked as SENT')
            setPoEmailDialog({ open: false, poId: null, email: '' })
            loadPurchaseOrders()
        } catch (err) {
            console.error(err)
        }
    }

    // -------- GRN --------
    function addGrnLine() {
        setGrnLines(ls => [
            ...ls,
            {
                item_id: '',
                po_item_id: null,
                batch_no: '',
                expiry_date: '',
                quantity: 0,
                free_quantity: 0,
                unit_cost: 0,
                tax_percent: 0,
                mrp: 0,
            },
        ])
    }

    function updateGrnLine(idx, field, value) {
        setGrnLines(ls =>
            ls.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
        )
    }

    function removeGrnLine(idx) {
        setGrnLines(ls => ls.filter((_, i) => i !== idx))
    }

    async function handleCreateGrn(e) {
        e.preventDefault()

        if (!grnForm.supplier_id || !grnForm.location_id) {
            toast.error('Supplier and location are required')
            return
        }

        const lines = (grnLines || [])
            .filter((l) => l.item_id && l.batch_no && n(l.quantity) > 0)
            .map((l) => ({
                item_id: Number(l.item_id),
                po_item_id: l.po_item_id ? Number(l.po_item_id) : null,

                batch_no: s(l.batch_no).trim(),
                expiry_date: d(l.expiry_date),

                quantity: n(l.quantity),
                free_quantity: n(l.free_quantity),

                unit_cost: n(l.unit_cost),
                mrp: n(l.mrp),

                discount_percent: n(l.discount_percent),
                discount_amount: n(l.discount_amount),

                tax_percent: n(l.tax_percent),
                cgst_percent: n(l.cgst_percent),
                sgst_percent: n(l.sgst_percent),
                igst_percent: n(l.igst_percent),

                scheme: s(l.scheme),
                remarks: s(l.remarks),
            }))

        if (lines.length === 0) {
            toast.error('Add at least one valid GRN line (item + batch + qty > 0)')
            return
        }

        const payload = {
            po_id: grnForm.po_id ? Number(grnForm.po_id) : null,
            supplier_id: Number(grnForm.supplier_id),
            location_id: Number(grnForm.location_id),

            received_date: grnForm.received_date || new Date().toISOString().slice(0, 10),

            invoice_number: s(grnForm.invoice_number),
            invoice_date: d(grnForm.invoice_date),

            supplier_invoice_amount: n(grnForm.supplier_invoice_amount),
            freight_amount: n(grnForm.freight_amount),
            other_charges: n(grnForm.other_charges),
            round_off: n(grnForm.round_off),

            difference_reason: s(grnForm.difference_reason),
            notes: s(grnForm.notes),

            items: lines,
        }

        try {
            console.log("GRN payload =>", JSON.stringify(payload, null, 2))
            await createGrn(payload)

            toast.success('GRN created in DRAFT')
            setGrnSheetOpen(false)
            setGrnLines([])

            setGrnForm({
                supplier_id: '',
                location_id: '',
                po_id: '',
                received_date: new Date().toISOString().slice(0, 10),
                invoice_number: '',
                invoice_date: '',
                supplier_invoice_amount: '',
                freight_amount: '',
                other_charges: '',
                round_off: '',
                difference_reason: '',
                notes: '',
            })

            loadGrns()
            loadStock()
        } catch (err) {
            toast.error('Failed to create GRN', {
                description: err?.response?.data?.detail || err.message || 'Try again',
            })
            console.error(err)
        }
    }


    async function handlePostGrn(id) {
        const tId = `post-grn-${id}`
        toast.loading('Posting GRN…', { id: tId })
        console.log(id, "svbjsvjhsbvjhsvjbsjbv");
        try {
            const resGRN = await postGrn(id, {}) // try first
            console.log(resGRN, "566552225555");
            toast.success('GRN posted & stock updated', { id: tId })
            await Promise.all([loadGrns(), loadStock(), loadPurchaseOrders()])
        } catch (err) {
            const detail = err?.response?.data?.detail || ''
            if (detail.includes('Provide difference_reason')) {
                // ask reason (prompt quick version)
                const reason = window.prompt('Invoice mismatch. Enter reason to post GRN:')
                if (reason && reason.trim()) {
                    await postGrn(id, { difference_reason: reason.trim() })
                    toast.success('GRN posted & stock updated', { id: tId })
                    await Promise.all([loadGrns(), loadStock(), loadPurchaseOrders()])
                    return
                }
            }
            console.log(err, "kfjgjsgvg");
            toast.error('Failed to post GRN', { id: tId, description: detail || 'Please try again.' })
            throw err
        }
    }



    // -------- returns --------
    function addReturnLine() {
        setReturnLines(ls => [
            ...ls,
            { item_id: '', batch_id: '', batch_no: '', quantity: 0, reason: '' },
        ])
    }

    function updateReturnLine(idx, field, value) {
        setReturnLines(ls =>
            ls.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
        )
    }

    function removeReturnLine(idx) {
        setReturnLines(ls => ls.filter((_, i) => i !== idx))
    }

    async function handleCreateReturn(e) {
        e.preventDefault()
        if (!returnForm.location_id || returnLines.length === 0) {
            toast.error('Location and at least one line are required')
            return
        }
        const payload = {
            type: returnForm.type,
            supplier_id: returnForm.supplier_id
                ? Number(returnForm.supplier_id)
                : null,
            location_id: Number(returnForm.location_id),
            return_date: new Date().toISOString().slice(0, 10),
            reason: returnForm.reason || '',
            items: returnLines
                .filter(l => l.item_id && l.quantity)
                .map(l => ({
                    item_id: Number(l.item_id),
                    batch_id: l.batch_id ? Number(l.batch_id) : null,
                    batch_no: l.batch_no ? l.batch_no.trim() : null,   // NEW
                    quantity: Number(l.quantity || 0),
                    reason: l.reason || '',
                })),
        }


        if (payload.items.length === 0) {
            toast.error('Add at least one valid return line')
            return
        }

        try {
            await createReturnNote(payload)
            toast.success('Return created in DRAFT')
            setReturnSheetOpen(false)
            setReturnLines([])
            setReturnForm({
                type: 'TO_SUPPLIER',
                supplier_id: '',
                location_id: '',
                reason: '',
            })
            loadReturns()
            loadStock()
        } catch (err) {
            console.error(err)
        }
    }
    // Auto-open return sheet for a specific batch (expired / quarantine)
    function startReturnForBatch(batch, mode = 'EXPIRED') {
        if (!batch) return

        const prettyName =
            batch.item?.name ||
            batch.name ||
            batch.item_name ||
            `Item #${batch.item_id ?? ''}`

        const reasonLabel =
            mode === 'EXPIRED'
                ? `Expired batch ${batch.batch_no || ''} (${prettyName})`
                : `Quarantine batch ${batch.batch_no || ''} (${prettyName})`

        setReturnSheetOpen(true)
        setReturnForm(prev => ({
            ...prev,
            // Default internal for expired; user can change to TO_SUPPLIER if needed
            type: mode === 'EXPIRED' ? 'INTERNAL' : prev.type,
            location_id: batch.location_id
                ? String(batch.location_id)
                : prev.location_id,
            reason: reasonLabel,
        }))

        setReturnLines([
            {
                item_id: String(batch.item_id),
                batch_id: String(batch.id),            // keep for direct reference
                batch_no: batch.batch_no || '',       // NEW – also keep human batch no
                quantity: Number(batch.current_qty ?? 0),
                reason:
                    mode === 'EXPIRED'
                        ? 'Expired'
                        : 'Quarantine / quality issue',
            },
        ])

    }

    async function handlePostReturn(id) {
        try {
            await postReturnNote(id)
            toast.success('Return posted & stock updated')
            loadReturns()
            loadStock()
        } catch (err) {
            console.error(err)
        }
    }


    const activeLocation = locations.find(
        l => String(l.id) === String(activeLocationId)
    )

    // -------- UI --------
    return (
        <motion.div
            className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
        >
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                        Pharmacy Inventory
                    </h1>
                    <p className="text-sm text-slate-500">
                        Batch-wise stock, purchase → GRN → returns, and full transaction
                        audit for NABH-compliant pharmacy management.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        value={activeLocationId}
                        onValueChange={val => {
                            setActiveLocationId(val)
                            setTimeout(loadStock, 0)
                        }}
                    >
                        <SelectTrigger className="w-48 bg-white">
                            <SelectValue
                                placeholder="All locations"
                                aria-label="Location filter"
                            />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All locations</SelectItem>
                            {locations.map(loc => (
                                <SelectItem key={loc.id} value={String(loc.id)}>
                                    {loc.code ? `${loc.code} — ${loc.name}` : loc.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full"
                        onClick={refreshAll}
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Top stats */}
            <div className="grid gap-4 mb-6 md:grid-cols-4">
                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-slate-500">
                            Active items
                        </CardTitle>
                        <Pill className="w-4 h-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-slate-900">
                            {totalActiveItems}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Medicines & consumables in catalogue
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-slate-500">
                            Near-expiry batches
                        </CardTitle>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-slate-900">
                            {totalBatchesNearExpiry}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Within alert window • Expired on shelf: {totalExpiredOnShelf}
                        </p>
                    </CardContent>
                </Card>


                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-slate-500">
                            Low-stock items
                        </CardTitle>
                        <PackageOpen className="w-4 h-4 text-sky-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-slate-900">
                            {totalLowStockItems}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Below reorder threshold • Quarantine: {totalQuarantineBatches}
                        </p>
                    </CardContent>
                </Card>


                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-slate-500">
                            Open purchase orders
                        </CardTitle>
                        <Truck className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-slate-900">
                            {totalPoOpen}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Draft / sent / partially received
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                <TabsList className="bg-slate-100 rounded-full p-1 flex flex-wrap gap-1">
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="items">Items</TabsTrigger>
                    <TabsTrigger value="locations">Locations</TabsTrigger>
                    <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                    <TabsTrigger value="stock">Stock & Alerts</TabsTrigger>
                    <TabsTrigger value="po">Purchase Orders</TabsTrigger>
                    <TabsTrigger value="grn">GRN</TabsTrigger>
                    <TabsTrigger value="returns">Returns</TabsTrigger>
                    <TabsTrigger value="txns">Transactions</TabsTrigger>
                </TabsList>

                {/* DASHBOARD TAB */}
                <TabsContent value="dashboard">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="rounded-3xl border-slate-200 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Expiry alerts
                                    <Badge variant="outline" className="text-xs">
                                        {expiryAlerts.length}
                                    </Badge>
                                </CardTitle>
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                            </CardHeader>
                            <CardContent className="space-y-3 max-h-[320px] overflow-auto">
                                {stockLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-8 w-full" />
                                        <Skeleton className="h-8 w-full" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                ) : expiryAlerts.length === 0 &&
                                    expiredAlerts.length === 0 ? (
                                    <p className="text-sm text-slate-500">
                                        No batches approaching expiry or expired on shelf for{' '}
                                        {activeLocation
                                            ? activeLocation.name
                                            : 'all locations'}
                                        .
                                    </p>
                                ) : (
                                    <>
                                        {expiredAlerts.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">
                                                    Expired on shelf
                                                </p>
                                                <div className="space-y-1.5">
                                                    {expiredAlerts.map(b => (
                                                        <div
                                                            key={`expired-${b.id}`}
                                                            className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2"
                                                        >
                                                            <div className="space-y-0.5">
                                                                <p className="text-sm font-medium text-slate-900">
                                                                    {b.item?.name ||
                                                                        b.name ||
                                                                        b.item_name ||
                                                                        `Item #${b.item_id ?? ''}`}
                                                                    {b.batch_no && (
                                                                        <span className="text-xs text-slate-500">
                                                                            {' '}
                                                                            ({b.batch_no})
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    Qty:{' '}
                                                                    {formatNumber(
                                                                        b.current_qty
                                                                    )}{' '}
                                                                    • Expired:{' '}
                                                                    {formatDate(
                                                                        b.expiry_date
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs border-rose-300 text-rose-700"
                                                                >
                                                                    Exp:{' '}
                                                                    {formatDate(
                                                                        b.expiry_date
                                                                    )}
                                                                </Badge>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-[11px]"
                                                                    onClick={() =>
                                                                        startReturnForBatch(
                                                                            b,
                                                                            'EXPIRED'
                                                                        )
                                                                    }
                                                                >
                                                                    Create return
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {expiryAlerts.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                                                    Near expiry
                                                </p>
                                                <div className="space-y-1.5">
                                                    {expiryAlerts.map(b => (
                                                        <div
                                                            key={`near-${b.id}`}
                                                            className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 bg-slate-50"
                                                        >
                                                            <div className="space-y-0.5">
                                                                <p className="text-sm font-medium text-slate-900">
                                                                    {b.item?.name ||
                                                                        b.name ||
                                                                        b.item_name ||
                                                                        `Item #${b.item_id ?? ''}`}
                                                                    {b.batch_no && (
                                                                        <span className="text-xs text-slate-500">
                                                                            {' '}
                                                                            ({b.batch_no})
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    Qty:{' '}
                                                                    {formatNumber(
                                                                        b.current_qty
                                                                    )}{' '}
                                                                    • Exp:{' '}
                                                                    {formatDate(
                                                                        b.expiry_date
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                Exp:{' '}
                                                                {formatDate(
                                                                    b.expiry_date
                                                                )}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>

                        </Card>

                        <Card className="rounded-3xl border-slate-200 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Stock alerts
                                    <Badge variant="outline" className="text-xs">
                                        {lowStock.length + maxStock.length}
                                    </Badge>
                                </CardTitle>
                                <Activity className="w-4 h-4 text-sky-500" />
                            </CardHeader>
                            <CardContent className="space-y-2 max-h-[320px] overflow-auto">
                                {stockLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-8 w-full" />
                                        <Skeleton className="h-8 w-full" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                ) : lowStock.length === 0 && maxStock.length === 0 ? (
                                    <p className="text-sm text-slate-500">
                                        No low / max stock issues for{' '}
                                        {activeLocation ? activeLocation.name : 'all locations'}.
                                    </p>
                                ) : (
                                    <>
                                        {lowStock.map(s => (
                                            <div
                                                key={`low-${s.item_id}-${s.location_id || 'all'}`}
                                                className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">
                                                        {s.name}
                                                    </p>
                                                    <p className="text-xs text-slate-600">
                                                        Qty: {formatNumber(s.total_qty)} / Reorder:{' '}
                                                        {formatNumber(s.reorder_level)}
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs border-amber-300 text-amber-700"
                                                >
                                                    Low stock
                                                </Badge>
                                            </div>
                                        ))}
                                        {maxStock.map(s => (
                                            <div
                                                key={`max-${s.item_id}-${s.location_id || 'all'}`}
                                                className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-3 py-2"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">
                                                        {s.name}
                                                    </p>
                                                    <p className="text-xs text-slate-600">
                                                        Qty: {formatNumber(s.total_qty)} / Max:{' '}
                                                        {formatNumber(s.max_level)}
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs border-sky-300 text-sky-700"
                                                >
                                                    Over-stock
                                                </Badge>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ITEMS TAB */}
                <TabsContent value="items">
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Pharmacy items
                                    <Badge variant="outline" className="text-xs">
                                        {items.length}
                                    </Badge>
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Medicines & consumables master — supports manual and CSV bulk
                                    upload.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => setCsvDialogOpen(true)}
                                >
                                    <Upload className="w-3 h-3" />
                                    CSV upload
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1"
                                    onClick={handleDownloadSampleCsv}
                                >
                                    <Download className="w-3 h-3" />
                                    Sample CSV
                                </Button>
                                <Button
                                    size="sm"
                                    className="gap-1"
                                    onClick={openNewItemDialog}
                                >
                                    <Plus className="w-3 h-3" />
                                    New item
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <Input
                                        placeholder="Search by name / code / generic..."
                                        className="w-full sm:w-80 bg-white"
                                        value={itemSearch}
                                        onChange={e => setItemSearch(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') loadItems()
                                        }}
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="rounded-full"
                                        onClick={loadItems}
                                    >
                                        <Filter className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                <div className="grid grid-cols-[2fr,1.2fr,1fr,1fr,0.6fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                    <span>Name / code</span>
                                    <span>Generic / form</span>
                                    <span>Default price / MRP</span>
                                    <span>Reorder / Max</span>
                                    <span className="text-right">Actions</span>
                                </div>
                                <div className="max-h-[420px] overflow-auto divide-y divide-slate-100">
                                    {itemsLoading ? (
                                        <div className="p-3 space-y-2">
                                            <Skeleton className="h-7 w-full" />
                                            <Skeleton className="h-7 w-full" />
                                            <Skeleton className="h-7 w-full" />
                                        </div>
                                    ) : items.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-500">
                                            No items found. Use “New item” or CSV upload to add
                                            catalogue.
                                        </div>
                                    ) : (
                                        items.map(it => (
                                            <div
                                                key={it.id}
                                                className="grid grid-cols-[2fr,1.2fr,1fr,1fr,0.6fr] items-center px-3 py-2 text-xs"
                                            >
                                                <div>
                                                    <div className="font-medium text-slate-900">
                                                        {it.name}
                                                    </div>
                                                    <div className="text-slate-500 flex flex-wrap items-center gap-1">
                                                        <span>{it.code}</span>
                                                        {it.is_consumable && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px]"
                                                            >
                                                                Consumable
                                                            </Badge>
                                                        )}
                                                        {it.lasa_flag && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px] border-rose-300 text-rose-600"
                                                            >
                                                                LASA
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-700">
                                                        {it.generic_name || '—'}
                                                    </div>
                                                    <div className="text-slate-500">
                                                        {it.form || '—'}{' '}
                                                        {it.strength && `• ${it.strength}`}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-700">
                                                        Price: ₹{formatNumber(it.default_price)}
                                                    </div>
                                                    <div className="text-slate-500">
                                                        MRP: ₹{formatNumber(it.default_mrp)} • Tax:{' '}
                                                        {formatNumber(it.default_tax_percent)}%
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-700">
                                                        Reorder: {formatNumber(it.reorder_level)}
                                                    </div>
                                                    <div className="text-slate-500">
                                                        Max: {formatNumber(it.max_level)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => openEditItemDialog(it)}
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* LOCATIONS TAB */}
                <TabsContent value="locations">
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Inventory locations
                                    <Badge variant="outline" className="text-xs">
                                        {locations.length}
                                    </Badge>
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Define pharmacy / store locations for stock segregation and
                                    reporting.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="gap-1"
                                onClick={openNewLocationDialog}
                            >
                                <Plus className="w-3 h-3" />
                                New location
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                <div className="grid grid-cols-[0.6fr,1.4fr,1fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                    <span>Code</span>
                                    <span>Name</span>
                                    <span className="text-right">Actions</span>
                                </div>
                                <div className="max-h-[440px] overflow-auto divide-y divide-slate-100">
                                    {locations.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-500">
                                            No locations defined yet. Click “New location” to add.
                                        </div>
                                    ) : (
                                        locations.map(loc => (
                                            <div
                                                key={loc.id}
                                                className="grid grid-cols-[0.6fr,1.4fr,1fr] items-center px-3 py-2 text-xs"
                                            >
                                                <div className="text-slate-900 font-medium">
                                                    {loc.code || '—'}
                                                </div>
                                                <div className="text-slate-900">
                                                    {loc.name}
                                                    {loc.description && (
                                                        <div className="text-[11px] text-slate-500">
                                                            {loc.description}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => openEditLocationDialog(loc)}
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* SUPPLIERS TAB */}
                <TabsContent value="suppliers">
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Suppliers
                                    <Badge variant="outline" className="text-xs">
                                        {suppliers.length}
                                    </Badge>
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Maintain vendor master for purchase orders, GRN, and returns.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="gap-1"
                                onClick={openNewSupplierDialog}
                            >
                                <Plus className="w-3 h-3" />
                                New supplier
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                <div className="grid grid-cols-[0.8fr,1.4fr,1.4fr,0.8fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                    <span>Code</span>
                                    <span>Name / contact</span>
                                    <span>Contact details</span>
                                    <span className="text-right">Actions</span>
                                </div>
                                <div className="max-h-[440px] overflow-auto divide-y divide-slate-100">
                                    {suppliers.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-500">
                                            No suppliers defined yet. Click “New supplier” to add.
                                        </div>
                                    ) : (
                                        suppliers.map(s => (
                                            <div
                                                key={s.id}
                                                className="grid grid-cols-[0.8fr,1.4fr,1.4fr,0.8fr] items-center px-3 py-2 text-xs"
                                            >
                                                <div className="text-slate-900 font-medium">
                                                    {s.code || '—'}
                                                </div>
                                                <div className="text-slate-900">
                                                    {s.name}
                                                    {s.contact_person && (
                                                        <div className="text-[11px] text-slate-500">
                                                            Contact: {s.contact_person}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-slate-700 text-[11px] space-y-0.5">
                                                    {s.phone && <div>📞 {s.phone}</div>}
                                                    {s.email && <div>✉️ {s.email}</div>}
                                                    {s.gst_number && (
                                                        <div className="text-slate-500">
                                                            GST: {s.gst_number}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => openEditSupplierDialog(s)}
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* STOCK TAB */}
                <TabsContent value="stock">
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Stock summary
                                    <Badge variant="outline" className="text-xs">
                                        {stock.length}
                                    </Badge>
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Location-wise quantities with low / max level indicators.
                                </p>
                            </div>
                            <ShieldAlert className="w-4 h-4 text-slate-400" />
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <Tabs
                                value={stockView}
                                onValueChange={setStockView}
                                className="space-y-3"
                            >
                                <TabsList className="bg-slate-100 rounded-full p-1 inline-flex gap-1">
                                    <TabsTrigger value="saleable">
                                        Saleable stock
                                    </TabsTrigger>
                                    <TabsTrigger value="quarantine">
                                        Expired &amp; quarantine
                                    </TabsTrigger>
                                </TabsList>

                                {/* SALEABLE STOCK */}
                                <TabsContent value="saleable" className="space-y-3">
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                        <div className="grid grid-cols-[2fr,1.2fr,1fr,0.8fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                            <span>Item</span>
                                            <span>Location</span>
                                            <span>Qty</span>
                                            <span>Status</span>
                                        </div>
                                        <div className="max-h-[440px] overflow-auto divide-y divide-slate-100">
                                            {stockLoading ? (
                                                <div className="p-3 space-y-2">
                                                    <Skeleton className="h-7 w-full" />
                                                    <Skeleton className="h-7 w-full" />
                                                    <Skeleton className="h-7 w-full" />
                                                </div>
                                            ) : stock.length === 0 ? (
                                                <div className="p-4 text-sm text-slate-500">
                                                    No stock summary yet.
                                                </div>
                                            ) : (
                                                stock.map(row => {
                                                    const badges = []
                                                    if (row.is_low) {
                                                        badges.push(
                                                            <Badge
                                                                key="low"
                                                                variant="outline"
                                                                className="border-amber-300 text-amber-700 text-[10px]"
                                                            >
                                                                Low
                                                            </Badge>
                                                        )
                                                    }
                                                    if (row.is_over) {
                                                        badges.push(
                                                            <Badge
                                                                key="max"
                                                                variant="outline"
                                                                className="border-sky-300 text-sky-700 text-[10px]"
                                                            >
                                                                Max
                                                            </Badge>
                                                        )
                                                    }
                                                    if (!badges.length) {
                                                        badges.push(
                                                            <Badge
                                                                key="ok"
                                                                variant="outline"
                                                                className="text-[10px]"
                                                            >
                                                                OK
                                                            </Badge>
                                                        )
                                                    }

                                                    return (
                                                        <div
                                                            key={`${row.item_id}-${row.location_id || 'all'}`}
                                                            className="grid grid-cols-[2fr,1.2fr,1fr,0.8fr] items-center px-3 py-2 text-xs"
                                                        >
                                                            <div>
                                                                <p className="font-medium text-slate-900">
                                                                    {row.name}
                                                                </p>
                                                                <p className="text-slate-500">
                                                                    {row.code}
                                                                </p>
                                                            </div>
                                                            <div className="text-slate-700">
                                                                {row.location_name ||
                                                                    'All locations'}
                                                            </div>
                                                            <div className="text-slate-700">
                                                                {formatNumber(
                                                                    row.total_qty
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1 flex-wrap">
                                                                {badges}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* QUARANTINE / NON-SALEABLE STOCK */}
                                <TabsContent value="quarantine" className="space-y-3">
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                        <div className="grid grid-cols-[2fr,1.2fr,1fr,1fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                            <span>Item / batch</span>
                                            <span>Location</span>
                                            <span>Qty / expiry</span>
                                            <span className="text-right">
                                                Status / actions
                                            </span>
                                        </div>
                                        <div className="max-h-[440px] overflow-auto divide-y divide-slate-100">
                                            {stockLoading ? (
                                                <div className="p-3 space-y-2">
                                                    <Skeleton className="h-7 w-full" />
                                                    <Skeleton className="h-7 w-full" />
                                                    <Skeleton className="h-7 w-full" />
                                                </div>
                                            ) : quarantineStock.length === 0 ? (
                                                <div className="p-4 text-sm text-slate-500">
                                                    No quarantine / written-off / returned
                                                    batches for{' '}
                                                    {activeLocation
                                                        ? activeLocation.name
                                                        : 'all locations'}
                                                    .
                                                </div>
                                            ) : (
                                                quarantineStock.map(b => {
                                                    const status = (b.status || '').toUpperCase()
                                                    let badgeClass = 'text-[10px]'
                                                    if (
                                                        status === 'EXPIRED' ||
                                                        status === 'WRITTEN_OFF'
                                                    ) {
                                                        badgeClass +=
                                                            ' border-rose-300 text-rose-700'
                                                    } else if (status === 'QUARANTINE') {
                                                        badgeClass +=
                                                            ' border-amber-300 text-amber-700'
                                                    } else if (status === 'RETURNED') {
                                                        badgeClass +=
                                                            ' border-slate-300 text-slate-600'
                                                    }

                                                    return (
                                                        <div
                                                            key={`q-${b.id}`}
                                                            className="grid grid-cols-[2fr,1.2fr,1fr,1fr] items-center px-3 py-2 text-xs"
                                                        >
                                                            <div>
                                                                <p className="font-medium text-slate-900">
                                                                    {b.item?.name ||
                                                                        b.name ||
                                                                        b.item_name ||
                                                                        `Item #${b.item_id ?? ''}`}
                                                                </p>
                                                                <p className="text-[11px] text-slate-500">
                                                                    Batch:{' '}
                                                                    {b.batch_no || '—'} • Code:{' '}
                                                                    {b.item?.code || '—'}
                                                                </p>
                                                            </div>
                                                            <div className="text-slate-700">
                                                                {b.location?.name || '—'}
                                                            </div>
                                                            <div>
                                                                <p className="text-slate-700">
                                                                    Qty:{' '}
                                                                    {formatNumber(
                                                                        b.current_qty
                                                                    )}
                                                                </p>
                                                                <p className="text-[11px] text-slate-500">
                                                                    Exp:{' '}
                                                                    {formatDate(
                                                                        b.expiry_date
                                                                    ) || '—'}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={badgeClass}
                                                                >
                                                                    {status || 'UNKNOWN'}
                                                                </Badge>
                                                                {status !== 'RETURNED' && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-[11px]"
                                                                        onClick={() =>
                                                                            startReturnForBatch(
                                                                                b,
                                                                                'QUARANTINE'
                                                                            )
                                                                        }
                                                                    >
                                                                        Create return
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>

                    </Card>
                </TabsContent>

                {/* PURCHASE ORDERS TAB */}
                <TabsContent value="po">
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Purchase orders
                                    <Badge variant="outline" className="text-xs">
                                        {purchaseOrders.length}
                                    </Badge>
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Create POs, print PDF, mark sent, and track status.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="gap-1"
                                onClick={() => setPoSheetOpen(true)}
                            >
                                <Plus className="w-3 h-3" />
                                New PO
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                <div className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
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
                                    ) : purchaseOrders.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-500">
                                            No purchase orders created yet.
                                        </div>
                                    ) : (
                                        purchaseOrders.map(po => (
                                            <div
                                                key={po.id}
                                                className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr] items-center px-3 py-2 text-xs"
                                            >
                                                <div>
                                                    <p className="font-medium text-slate-900">
                                                        {po.po_number}
                                                    </p>
                                                    <p className="text-slate-500">
                                                        Created: {formatDate(po.order_date)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-900">
                                                        {po.supplier?.name}
                                                    </p>
                                                    <p className="text-slate-500 text-[11px]">
                                                        {po.supplier?.phone ||
                                                            po.supplier?.email ||
                                                            '—'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-900">
                                                        {po.location?.name}
                                                    </p>
                                                    <p className="text-slate-500 text-[11px]">
                                                        Exp:{' '}
                                                        {po.expected_date
                                                            ? formatDate(po.expected_date)
                                                            : '—'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] capitalize"
                                                    >
                                                        {po.status.toLowerCase()}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => handlePrintPo(po.id)}
                                                    >
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
                                                                email: po.email_sent_to || '',
                                                            })
                                                        }
                                                    >
                                                        <Mail className="w-3 h-3" />
                                                    </Button>
                                                    {po.status === 'DRAFT' ||
                                                        po.status === 'SENT' ? (
                                                        <Select
                                                            defaultValue={po.status}
                                                            onValueChange={val =>
                                                                handleChangePoStatus(po.id, val)
                                                            }
                                                        >
                                                            <SelectTrigger className="h-7 w-24 text-[11px] bg-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="DRAFT">
                                                                    DRAFT
                                                                </SelectItem>
                                                                <SelectItem value="SENT">
                                                                    SENT
                                                                </SelectItem>
                                                                <SelectItem value="PARTIALLY_RECEIVED">
                                                                    PARTIAL
                                                                </SelectItem>
                                                                <SelectItem value="COMPLETED">
                                                                    COMPLETED
                                                                </SelectItem>
                                                                <SelectItem value="CANCELLED">
                                                                    CANCELLED
                                                                </SelectItem>
                                                                <SelectItem value="CLOSED">
                                                                    CLOSED
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] capitalize"
                                                        >
                                                            {po.status.toLowerCase()}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* GRN TAB */}
                <TabsContent value="grn" className="space-y-4">
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Goods Receipt Notes
                                    <Badge variant="outline" className="text-xs">
                                        {grns.length}
                                    </Badge>
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Create GRN in DRAFT, then <span className="font-medium">Post</span> to create batches & update stock.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9"
                                    onClick={() => {
                                        // optional quick refresh if you have a loader function
                                        // loadGrns?.()
                                    }}
                                >
                                    Refresh
                                </Button>

                                <Button
                                    size="sm"
                                    className="h-9 gap-1"
                                    onClick={() => setGrnSheetOpen(true)}
                                >
                                    <Plus className="w-4 h-4" />
                                    New GRN
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            {/* Toolbar */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                    <div className="w-full sm:w-72">
                                        <Input
                                            placeholder="Search GRN / supplier / invoice..."
                                            value={grnQuery}
                                            onChange={(e) => setGrnQuery(e.target.value)}
                                            className="h-9 bg-white"
                                        />
                                    </div>

                                    <div className="w-full sm:w-44">
                                        <Select value={grnStatus} onValueChange={setGrnStatus}>
                                            <SelectTrigger className="h-9 bg-white">
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
                                </div>

                                <div className="text-xs text-slate-500">
                                    {grnLoading ? 'Loading…' : `${filteredGrns.length} result(s)`}
                                </div>
                            </div>

                            {/* Desktop table */}
                            <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                <div className="grid grid-cols-[1.2fr,1.1fr,1.2fr,0.9fr,0.9fr,0.9fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                    <span>GRN</span>
                                    <span>Supplier</span>
                                    <span>Location / Invoice</span>
                                    <span>Amounts</span>
                                    <span>Status</span>
                                    <span className="text-right">Actions</span>
                                </div>

                                <div className="max-h-[480px] overflow-auto divide-y divide-slate-100">
                                    {grnLoading ? (
                                        <div className="p-3 space-y-2">
                                            <Skeleton className="h-8 w-full" />
                                            <Skeleton className="h-8 w-full" />
                                            <Skeleton className="h-8 w-full" />
                                        </div>
                                    ) : filteredGrns.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-500">No GRNs found.</div>
                                    ) : (
                                        filteredGrns.map((grn) => {
                                            const diff = Number(grn.amount_difference || 0)
                                            const hasMismatch = Math.abs(diff) >= 0.01 && Number(grn.supplier_invoice_amount || 0) > 0

                                            return (
                                                <div
                                                    key={grn.id}
                                                    className="grid grid-cols-[1.2fr,1.1fr,1.2fr,0.9fr,0.9fr,0.9fr] items-center px-3 py-2 text-xs hover:bg-slate-50"
                                                >
                                                    <div>
                                                        <p className="font-medium text-slate-900">{grn.grn_number || `GRN-${String(grn.id).padStart(6, '0')}`}</p>
                                                        <p className="text-slate-500">
                                                            Received: {formatDate(grn.received_date)}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-slate-900">{grn.supplier?.name || '—'}</p>
                                                        <p className="text-slate-500 text-[11px]">
                                                            {grn.supplier?.phone || grn.supplier?.email || '—'}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-slate-900">{grn.location?.name || '—'}</p>
                                                        <p className="text-slate-500 text-[11px]">
                                                            Inv: {grn.invoice_number || '—'} {grn.invoice_date ? `• ${formatDate(grn.invoice_date)}` : ''}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-slate-900">
                                                            Inv: ₹{Number(grn.supplier_invoice_amount || 0).toFixed(2)}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                            <span>Calc: ₹{Number(grn.calculated_grn_amount || 0).toFixed(2)}</span>
                                                            {hasMismatch && (
                                                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                                                                    Diff ₹{diff.toFixed(2)}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <Badge
                                                            variant="outline"
                                                            className={[
                                                                'text-[10px] capitalize',
                                                                grn.status === 'POSTED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : '',
                                                                grn.status === 'CANCELLED' ? 'bg-rose-50 border-rose-200 text-rose-800' : '',
                                                                grn.status === 'DRAFT' ? 'bg-slate-50 border-slate-200 text-slate-700' : '',
                                                            ].join(' ')}
                                                        >
                                                            {(grn.status || 'DRAFT').toLowerCase()}
                                                        </Badge>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => openGrnPreview?.(grn)} // optional hook
                                                            title="View"
                                                        >
                                                            <ClipboardList className="w-4 h-4" />
                                                        </Button>

                                                        {grn.status === 'DRAFT' && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 px-3 text-[11px]"
                                                                onClick={() => onClickPost(grn)}
                                                            >
                                                                Post GRN
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Mobile cards */}
                            <div className="md:hidden space-y-2">
                                {grnLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-24 w-full rounded-2xl" />
                                        <Skeleton className="h-24 w-full rounded-2xl" />
                                    </div>
                                ) : filteredGrns.length === 0 ? (
                                    <div className="p-4 text-sm text-slate-500 rounded-2xl border border-slate-200 bg-white">
                                        No GRNs found.
                                    </div>
                                ) : (
                                    filteredGrns.map((grn) => {
                                        const diff = Number(grn.amount_difference || 0)
                                        const hasMismatch = Math.abs(diff) >= 0.01 && Number(grn.supplier_invoice_amount || 0) > 0

                                        return (
                                            <div key={grn.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="font-semibold text-slate-900 text-sm">
                                                            {grn.grn_number || `GRN-${String(grn.id).padStart(6, '0')}`}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {formatDate(grn.received_date)} • {grn.location?.name || '—'}
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant="outline"
                                                        className={[
                                                            'text-[10px] capitalize',
                                                            grn.status === 'POSTED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : '',
                                                            grn.status === 'CANCELLED' ? 'bg-rose-50 border-rose-200 text-rose-800' : '',
                                                            grn.status === 'DRAFT' ? 'bg-slate-50 border-slate-200 text-slate-700' : '',
                                                        ].join(' ')}
                                                    >
                                                        {(grn.status || 'DRAFT').toLowerCase()}
                                                    </Badge>
                                                </div>

                                                <div className="mt-2 text-xs">
                                                    <div className="text-slate-700">
                                                        <span className="text-slate-500">Supplier:</span>{' '}
                                                        {grn.supplier?.name || '—'}
                                                    </div>
                                                    <div className="text-slate-700">
                                                        <span className="text-slate-500">Invoice:</span>{' '}
                                                        {grn.invoice_number || '—'} {grn.invoice_date ? `• ${formatDate(grn.invoice_date)}` : ''}
                                                    </div>
                                                    <div className="mt-1 text-slate-700 flex items-center gap-2">
                                                        <span>
                                                            <span className="text-slate-500">Inv:</span> ₹{Number(grn.supplier_invoice_amount || 0).toFixed(2)}
                                                        </span>
                                                        <span>
                                                            <span className="text-slate-500">Calc:</span> ₹{Number(grn.calculated_grn_amount || 0).toFixed(2)}
                                                        </span>
                                                        {hasMismatch && (
                                                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                                                                Diff ₹{diff.toFixed(2)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() => openGrnPreview?.(grn)}
                                                    >
                                                        View
                                                    </Button>
                                                    {grn.status === 'DRAFT' && (
                                                        <div className="flex items-center justify-end gap-2">
                                                            {Number(grn.amount_difference || 0) !== 0 && (
                                                                <Input
                                                                    className="h-8 w-56 text-xs bg-white"
                                                                    placeholder="Difference reason (required)"
                                                                    value={postReason[grn.id] || ''}
                                                                    onChange={(e) =>
                                                                        setPostReason((s) => ({ ...s, [grn.id]: e.target.value }))
                                                                    }
                                                                />
                                                            )}

                                                            <Button
                                                                size="sm"
                                                                className="h-8"
                                                                onClick={() => handlePostGrn(grn.id, postReason[grn.id] || '')}
                                                            >
                                                                Post
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>


                {/* RETURNS TAB */}
                <TabsContent value="returns">
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Returns
                                    <Badge variant="outline" className="text-xs">
                                        {returns.length}
                                    </Badge>
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Manage returns to suppliers, from customers, and internal
                                    adjustments.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="gap-1"
                                onClick={() => setReturnSheetOpen(true)}
                            >
                                <Plus className="w-3 h-3" />
                                New return
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                <div className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                    <span>Return no.</span>
                                    <span>Type / supplier</span>
                                    <span>Location / reason</span>
                                    <span>Status</span>
                                    <span className="text-right">Actions</span>
                                </div>
                                <div className="max-h-[440px] overflow-auto divide-y divide-slate-100">
                                    {returnLoading ? (
                                        <div className="p-3 space-y-2">
                                            <Skeleton className="h-7 w-full" />
                                            <Skeleton className="h-7 w-full" />
                                            <Skeleton className="h-7 w-full" />
                                        </div>
                                    ) : returns.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-500">
                                            No returns recorded yet.
                                        </div>
                                    ) : (
                                        returns.map(rn => (
                                            <div
                                                key={rn.id}
                                                className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr] items-center px-3 py-2 text-xs"
                                            >
                                                <div>
                                                    <p className="font-medium text-slate-900">
                                                        {rn.return_number}
                                                    </p>
                                                    <p className="text-slate-500">
                                                        Date: {formatDate(rn.return_date)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-900">
                                                        {rn.type.replace('_', ' ')}
                                                    </p>
                                                    <p className="text-slate-500 text-[11px]">
                                                        {rn.supplier?.name || '—'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-900">
                                                        {rn.location?.name}
                                                    </p>
                                                    <p className="text-slate-500 text-[11px]">
                                                        {rn.reason || '—'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] capitalize"
                                                    >
                                                        {rn.status.toLowerCase()}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-end gap-2">
                                                    {rn.status === 'DRAFT' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 px-2 text-[11px]"
                                                            onClick={() => handlePostReturn(rn.id)}
                                                        >
                                                            Post return
                                                        </Button>
                                                    )}
                                                </div>

                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TRANSACTIONS TAB */}
                <TabsContent value="txns">
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    Stock transactions
                                    <Badge variant="outline" className="text-xs">
                                        {txns.length}
                                    </Badge>
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Full audit trail of every stock movement (GRN, dispense,
                                    returns, adjustments).
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                <div className="grid grid-cols-[1.1fr,1.4fr,1fr,1.1fr,0.9fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                    <span>Date / type</span>
                                    <span>Item / batch</span>
                                    <span>Location</span>
                                    <span>Qty / cost</span>
                                    <span>User / ref</span>
                                </div>
                                <div className="max-h-[440px] overflow-auto divide-y divide-slate-100">
                                    {txnLoading ? (
                                        <div className="p-3 space-y-2">
                                            <Skeleton className="h-7 w-full" />
                                            <Skeleton className="h-7 w-full" />
                                            <Skeleton className="h-7 w-full" />
                                        </div>
                                    ) : txns.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-500">
                                            No stock transactions yet.
                                        </div>
                                    ) : (
                                        txns.map(tx => (
                                            <div
                                                key={tx.id}
                                                className="grid grid-cols-[1.1fr,1.4fr,1fr,1.1fr,0.9fr] items-center px-3 py-2 text-xs"
                                            >
                                                <div>
                                                    <p className="font-medium text-slate-900">
                                                        {formatDate(tx.txn_time)}
                                                    </p>
                                                    <p className="text-slate-500">
                                                        {tx.txn_type}{' '}
                                                        {tx.ref_display
                                                            ? `• ${tx.ref_display}`
                                                            : tx.ref_type && tx.ref_id
                                                                ? `• ${tx.ref_type} #${tx.ref_id}`
                                                                : ''}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-slate-900">
                                                        {tx.item_name || `Item #${tx.item_id}`}
                                                    </p>
                                                    <p className="text-slate-500 text-[11px]">
                                                        {tx.item_code && <span>Code: {tx.item_code} • </span>}
                                                        Batch:{' '}
                                                        {tx.batch_no
                                                            ? tx.batch_no
                                                            : tx.batch_id
                                                                ? `#${tx.batch_id}`
                                                                : '—'}
                                                    </p>
                                                </div>

                                                <div className="text-slate-700">
                                                    {tx.location_name ||
                                                        (tx.location_id ? `Location #${tx.location_id}` : '—')}
                                                </div>

                                                <div>
                                                    <p className="text-slate-900">
                                                        Qty: {formatNumber(tx.quantity_change)}
                                                    </p>
                                                    <p className="text-slate-500 text-[11px]">
                                                        Rate: ₹{formatNumber(tx.unit_cost)} • MRP: ₹
                                                        {formatNumber(tx.mrp)}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-slate-900 text-[11px]">
                                                        {tx.user_name ||
                                                            (tx.user_id ? `User #${tx.user_id}` : 'System')}
                                                    </p>
                                                    <p className="text-slate-500 text-[11px]">
                                                        {tx.ref_display ||
                                                            (tx.ref_type && tx.ref_id
                                                                ? `${tx.ref_type} #${tx.ref_id}`
                                                                : '—')}
                                                    </p>
                                                </div>

                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* -------- Modals / Sheets -------- */}

            {/* Item create/edit dialog */}
            <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">
                            {editItem ? 'Edit item' : 'New item'}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Maintain medicine / consumable master details, including LASA flag
                            and stock thresholds.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveItem} className="space-y-4">
                        {/* BASIC DETAILS + BARCODE */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="code">Code</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    defaultValue={editItem?.code || ''}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="qr_number">Barcode number (scan code)</Label>
                                <Input
                                    id="qr_number"
                                    name="qr_number"
                                    placeholder="Leave blank to auto-generate"
                                    defaultValue={editItem?.qr_number || ''}
                                />
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Optional. Empty =&nbsp;system will create MD_XXXX.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="name">Name (brand)</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={editItem?.name || ''}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="generic_name">Generic name</Label>
                                <Input
                                    id="generic_name"
                                    name="generic_name"
                                    defaultValue={editItem?.generic_name || ''}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="form">Form</Label>
                                <Input
                                    id="form"
                                    name="form"
                                    placeholder="tablet / capsule / syrup..."
                                    defaultValue={editItem?.form || ''}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="strength">Strength</Label>
                                <Input
                                    id="strength"
                                    name="strength"
                                    placeholder="500 mg / 5 mg/ml"
                                    defaultValue={editItem?.strength || ''}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="unit">Unit</Label>
                                <Input
                                    id="unit"
                                    name="unit"
                                    placeholder="tablet / ml / vial"
                                    defaultValue={editItem?.unit || 'tablet'}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="pack_size">Pack size</Label>
                                <Input
                                    id="pack_size"
                                    name="pack_size"
                                    defaultValue={editItem?.pack_size || '10'}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="manufacturer">Manufacturer</Label>
                                <Input
                                    id="manufacturer"
                                    name="manufacturer"
                                    defaultValue={editItem?.manufacturer || ''}
                                />
                            </div>
                        </div>

                        {/* PRICING */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="default_price">Default price</Label>
                                <Input
                                    id="default_price"
                                    name="default_price"
                                    type="number"
                                    step="0.01"
                                    defaultValue={editItem?.default_price || ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="default_mrp">Default MRP</Label>
                                <Input
                                    id="default_mrp"
                                    name="default_mrp"
                                    type="number"
                                    step="0.01"
                                    defaultValue={editItem?.default_mrp || ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="default_tax_percent">Tax %</Label>
                                <Input
                                    id="default_tax_percent"
                                    name="default_tax_percent"
                                    type="number"
                                    step="0.01"
                                    defaultValue={editItem?.default_tax_percent || ''}
                                />
                            </div>
                        </div>

                        {/* LEVELS + CLASS */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="reorder_level">Reorder level</Label>
                                <Input
                                    id="reorder_level"
                                    name="reorder_level"
                                    type="number"
                                    step="0.01"
                                    defaultValue={editItem?.reorder_level || ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="max_level">Max level</Label>
                                <Input
                                    id="max_level"
                                    name="max_level"
                                    type="number"
                                    step="0.01"
                                    defaultValue={editItem?.max_level || ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="class_name">Therapeutic class</Label>
                                <Input
                                    id="class_name"
                                    name="class_name"
                                    defaultValue={editItem?.class_name || ''}
                                />
                            </div>
                        </div>

                        {/* CODES + FLAGS */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="atc_code">ATC code</Label>
                                <Input
                                    id="atc_code"
                                    name="atc_code"
                                    defaultValue={editItem?.atc_code || ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="hsn_code">HSN code</Label>
                                <Input
                                    id="hsn_code"
                                    name="hsn_code"
                                    defaultValue={editItem?.hsn_code || ''}
                                />
                            </div>
                            <div className="flex items-center gap-4 mt-6 text-xs">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        name="is_consumable"
                                        defaultChecked={editItem?.is_consumable}
                                        className="rounded border-slate-300"
                                    />
                                    Consumable
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        name="lasa_flag"
                                        defaultChecked={editItem?.lasa_flag}
                                        className="rounded border-slate-300"
                                    />
                                    LASA (Look-alike / Sound-alike)
                                </label>
                            </div>
                        </div>

                        <DialogFooter className="flex justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setItemDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editItem ? 'Save changes' : 'Create item'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* CSV upload dialog */}
            <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">
                            Bulk upload items (CSV)
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Download the sample template, fill with medicines / consumables,
                            then upload here. Existing codes will be updated.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUploadCsv} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="file">CSV file</Label>
                            <Input
                                id="file"
                                name="file"
                                type="file"
                                accept=".csv"
                                required
                                className="bg-white"
                            />
                        </div>
                        <DialogFooter className="flex justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCsvDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" className="gap-1">
                                <Upload className="w-3 h-3" />
                                Upload CSV
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Location create/edit dialog */}
            <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">
                            {editLocation ? 'Edit location' : 'New location'}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Define pharmacy / store location used for stock and GRN posting.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveLocation} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="loc_code">Code</Label>
                                <Input
                                    id="loc_code"
                                    name="code"
                                    defaultValue={editLocation?.code || ''}
                                    placeholder="PHARM1 / MAIN"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="loc_name">Name</Label>
                                <Input
                                    id="loc_name"
                                    name="name"
                                    required
                                    defaultValue={editLocation?.name || ''}
                                    placeholder="Main Pharmacy"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="loc_desc">Description</Label>
                            <Input
                                id="loc_desc"
                                name="description"
                                defaultValue={editLocation?.description || ''}
                                placeholder="Optional description"
                            />
                        </div>
                        <DialogFooter className="flex justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setLocationDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editLocation ? 'Save changes' : 'Create location'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Supplier create/edit dialog */}
            <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">
                            {editSupplier ? 'Edit supplier' : 'New supplier'}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Vendor details used for purchase orders, GRNs, and returns.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveSupplier} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="sup_code">Code</Label>
                                <Input
                                    id="sup_code"
                                    name="code"
                                    defaultValue={editSupplier?.code || ''}
                                    placeholder="SUPP001"
                                />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="sup_name">Name</Label>
                                <Input
                                    id="sup_name"
                                    name="name"
                                    required
                                    defaultValue={editSupplier?.name || ''}
                                    placeholder="ABC Pharma Distributors"
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="sup_contact_person">Contact person</Label>
                                <Input
                                    id="sup_contact_person"
                                    name="contact_person"
                                    defaultValue={editSupplier?.contact_person || ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sup_phone">Phone</Label>
                                <Input
                                    id="sup_phone"
                                    name="phone"
                                    defaultValue={editSupplier?.phone || ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sup_email">Email</Label>
                                <Input
                                    id="sup_email"
                                    type="email"
                                    name="email"
                                    defaultValue={editSupplier?.email || ''}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="sup_gst">GST number</Label>
                                <Input
                                    id="sup_gst"
                                    name="gst_number"
                                    defaultValue={editSupplier?.gst_number || ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sup_address">Address</Label>
                                <Input
                                    id="sup_address"
                                    name="address"
                                    defaultValue={editSupplier?.address || ''}
                                    placeholder="City / area / address"
                                />
                            </div>
                        </div>

                        <DialogFooter className="flex justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSupplierDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editSupplier ? 'Save changes' : 'Create supplier'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Purchase Order sheet */}
            <Sheet open={poSheetOpen} onOpenChange={setPoSheetOpen}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="text-base font-semibold">
                            New Purchase Order
                        </SheetTitle>
                        <SheetDescription className="text-xs">
                            Select supplier & location, then add items with quantities and
                            pricing.
                        </SheetDescription>
                    </SheetHeader>
                    <form onSubmit={handleCreatePo} className="space-y-4 pb-6">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Supplier</Label>
                                <Select
                                    value={poForm.supplier_id}
                                    onValueChange={val =>
                                        setPoForm(f => ({ ...f, supplier_id: val }))
                                    }
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Select supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.id} value={String(s.id)}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Location</Label>
                                <Select
                                    value={poForm.location_id}
                                    onValueChange={val =>
                                        setPoForm(f => ({ ...f, location_id: val }))
                                    }
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Select location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.map(l => (
                                            <SelectItem key={l.id} value={String(l.id)}>
                                                {l.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Expected date</Label>
                                <Input
                                    type="date"
                                    value={poForm.expected_date}
                                    onChange={e =>
                                        setPoForm(f => ({
                                            ...f,
                                            expected_date: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Notes</Label>
                                <Input
                                    placeholder="Any special instructions"
                                    value={poForm.notes}
                                    onChange={e =>
                                        setPoForm(f => ({ ...f, notes: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Line items</Label>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={addPoLine}
                                >
                                    <Plus className="w-3 h-3" />
                                    Add line
                                </Button>
                            </div>
                            {newPoLines.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                    No lines yet. Click “Add line” to start.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                                    {newPoLines.map((ln, idx) => (
                                        <div
                                            key={idx}
                                            className="grid gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[1.6fr,0.8fr,0.8fr,0.8fr,0.4fr]"
                                        >
                                            <Select
                                                value={ln.item_id ? String(ln.item_id) : ''}
                                                onValueChange={val =>
                                                    updatePoLine(idx, 'item_id', val)
                                                }
                                            >
                                                <SelectTrigger className="bg-white h-8">
                                                    <SelectValue placeholder="Item" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {items.map(it => (
                                                        <SelectItem key={it.id} value={String(it.id)}>
                                                            {it.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="h-8"
                                                placeholder="Qty"
                                                value={ln.ordered_qty}
                                                onChange={e =>
                                                    updatePoLine(
                                                        idx,
                                                        'ordered_qty',
                                                        e.target.value
                                                    )
                                                }
                                            />
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="h-8"
                                                placeholder="Rate"
                                                value={ln.unit_cost}
                                                onChange={e =>
                                                    updatePoLine(
                                                        idx,
                                                        'unit_cost',
                                                        e.target.value
                                                    )
                                                }
                                            />
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="h-8"
                                                placeholder="Tax %"
                                                value={ln.tax_percent}
                                                onChange={e =>
                                                    updatePoLine(
                                                        idx,
                                                        'tax_percent',
                                                        e.target.value
                                                    )
                                                }
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => removePoLine(idx)}
                                            >
                                                ✕
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPoSheetOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">Create PO</Button>
                        </div>
                    </form>
                </SheetContent>
            </Sheet>

            {/* PO email dialog */}
            <Dialog
                open={poEmailDialog.open}
                onOpenChange={open =>
                    setPoEmailDialog(prev => ({ ...prev, open }))
                }
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">
                            Mark PO as sent
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Enter supplier email used to send PO PDF. This will be stored in
                            PO history.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleMarkPoSent} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={poEmailDialog.email}
                                onChange={e =>
                                    setPoEmailDialog(prev => ({
                                        ...prev,
                                        email: e.target.value,
                                    }))
                                }
                                required
                            />
                        </div>
                        <DialogFooter className="flex justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setPoEmailDialog({
                                        open: false,
                                        poId: null,
                                        email: '',
                                    })
                                }
                            >
                                Cancel
                            </Button>
                            <Button type="submit" className="gap-1">
                                <Mail className="w-3 h-3" />
                                Mark as sent
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* GRN sheet */}
            <Sheet open={grnSheetOpen} onOpenChange={setGrnSheetOpen}>
                <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="text-base font-semibold">New GRN (DRAFT)</SheetTitle>
                        <SheetDescription className="text-xs">
                            Capture supplier invoice + batches. Post later to update stock.
                        </SheetDescription>
                    </SheetHeader>

                    {/* ---------- helpers inside component scope ---------- */}
                    {/*
      Place these helper functions at top of your component if not already:
      const n = (v) => (v === '' || v == null ? 0 : (Number.isFinite(Number(v)) ? Number(v) : 0))
      const money = (x) => (Math.round((n(x)+Number.EPSILON)*100)/100).toFixed(2)
    */}

                    {/* ---------- totals (client side) ---------- */}
                    {(() => {
                        const n = (v) => (v === '' || v == null ? 0 : (Number.isFinite(Number(v)) ? Number(v) : 0))
                        const money = (x) => (Math.round((n(x) + Number.EPSILON) * 100) / 100).toFixed(2)

                        const subtotal = grnLines.reduce((s, ln) => s + n(ln.quantity) * n(ln.unit_cost), 0)

                        const discount = grnLines.reduce((s, ln) => {
                            const gross = n(ln.quantity) * n(ln.unit_cost)
                            const discAmt = n(ln.discount_amount)
                            const discPct = n(ln.discount_percent)
                            return s + (discAmt > 0 ? discAmt : (discPct > 0 ? (gross * discPct) / 100 : 0))
                        }, 0)

                        const taxable = Math.max(0, subtotal - discount)

                        const tax = grnLines.reduce((s, ln) => {
                            const gross = n(ln.quantity) * n(ln.unit_cost)
                            const discAmt = n(ln.discount_amount)
                            const discPct = n(ln.discount_percent)
                            const disc = discAmt > 0 ? discAmt : (discPct > 0 ? (gross * discPct) / 100 : 0)
                            const base = Math.max(0, gross - disc)

                            const cgstP = n(ln.cgst_percent)
                            const sgstP = n(ln.sgst_percent)
                            const igstP = n(ln.igst_percent)
                            const tp = n(ln.tax_percent)

                            const splitP = cgstP + sgstP + igstP
                            if (splitP > 0) return s + (base * splitP) / 100
                            if (tp > 0) return s + (base * tp) / 100
                            return s
                        }, 0)

                        const extras = n(grnForm.freight_amount) + n(grnForm.other_charges) + n(grnForm.round_off)
                        const calculated = taxable + tax + extras
                        const invoice = n(grnForm.supplier_invoice_amount)
                        const diff = invoice - calculated
                        const mismatch = invoice > 0 && Math.abs(diff) >= 0.01

                        return (
                            <form
                                onSubmit={(e) => {
                                    // enforce mismatch reason on submit (safe client-side)
                                    if (mismatch && !String(grnForm.difference_reason || '').trim()) {
                                        e.preventDefault()
                                        toast.error('Difference Reason required', {
                                            description: 'Invoice amount and calculated amount do not match.',
                                        })
                                        return
                                    }
                                    handleCreateGrn(e)
                                }}
                                className="space-y-5 pb-8"
                            >
                                {/* ---------------- Header: Supplier + Invoice ---------------- */}
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label>Supplier</Label>
                                            <Select
                                                value={grnForm.supplier_id}
                                                onValueChange={(val) => setGrnForm((f) => ({ ...f, supplier_id: val }))}
                                            >
                                                <SelectTrigger className="bg-white">
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
                                            <Label>Location</Label>
                                            <Select
                                                value={grnForm.location_id}
                                                onValueChange={(val) => setGrnForm((f) => ({ ...f, location_id: val }))}
                                            >
                                                <SelectTrigger className="bg-white">
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
                                            <Label>Invoice Number</Label>
                                            <Input
                                                className="bg-white"
                                                value={grnForm.invoice_number}
                                                onChange={(e) => setGrnForm((f) => ({ ...f, invoice_number: e.target.value }))}
                                                placeholder="Supplier bill no"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label>Invoice Date</Label>
                                            <Input
                                                type="date"
                                                className="bg-white"
                                                value={grnForm.invoice_date}
                                                onChange={(e) => setGrnForm((f) => ({ ...f, invoice_date: e.target.value }))}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label>Supplier Invoice Amount (Net)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="bg-white"
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
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="bg-white"
                                                    value={grnForm.freight_amount}
                                                    onChange={(e) => setGrnForm((f) => ({ ...f, freight_amount: e.target.value }))}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>Other Charges</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="bg-white"
                                                    value={grnForm.other_charges}
                                                    onChange={(e) => setGrnForm((f) => ({ ...f, other_charges: e.target.value }))}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>Round Off</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    className="bg-white"
                                                    value={grnForm.round_off}
                                                    onChange={(e) => setGrnForm((f) => ({ ...f, round_off: e.target.value }))}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        <div className="sm:col-span-2 space-y-1.5">
                                            <Label>Notes</Label>
                                            <Input
                                                className="bg-white"
                                                value={grnForm.notes}
                                                onChange={(e) => setGrnForm((f) => ({ ...f, notes: e.target.value }))}
                                                placeholder="Optional"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ---------------- Line items ---------------- */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-sm">Line items</Label>
                                            <p className="text-xs text-slate-500">
                                                Add batch-wise lines. Free qty is included in stock on POST.
                                            </p>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addGrnLine}>
                                            <Plus className="w-3 h-3" />
                                            Add line
                                        </Button>
                                    </div>

                                    {grnLines.length === 0 ? (
                                        <p className="text-xs text-slate-500">
                                            No lines yet. Click “Add line” to add received batches.
                                        </p>
                                    ) : (
                                        <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                                            {grnLines.map((ln, idx) => (
                                                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="text-xs font-medium text-slate-600">Line #{idx + 1}</div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => removeGrnLine(idx)}
                                                            title="Remove line"
                                                        >
                                                            ✕
                                                        </Button>
                                                    </div>

                                                    {/* Responsive grid: mobile stacks nicely */}
                                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                                                        <div className="lg:col-span-2">
                                                            <Label className="text-xs">Item</Label>
                                                            <Select
                                                                value={ln.item_id ? String(ln.item_id) : ''}
                                                                onValueChange={(val) => updateGrnLine(idx, 'item_id', val)}
                                                            >
                                                                <SelectTrigger className="bg-white h-9">
                                                                    <SelectValue placeholder="Select item" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {items.map((it) => (
                                                                        <SelectItem key={it.id} value={String(it.id)}>
                                                                            {it.code ? `${it.code} — ${it.name}` : it.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">Batch No</Label>
                                                            <Input
                                                                className="h-9"
                                                                placeholder="Batch"
                                                                value={ln.batch_no}
                                                                onChange={(e) => updateGrnLine(idx, 'batch_no', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">Expiry</Label>
                                                            <Input
                                                                type="date"
                                                                className="h-9"
                                                                value={ln.expiry_date}
                                                                onChange={(e) => updateGrnLine(idx, 'expiry_date', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">Qty</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                placeholder="Qty"
                                                                value={ln.quantity}
                                                                onChange={(e) => updateGrnLine(idx, 'quantity', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">Free</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                placeholder="Free"
                                                                value={ln.free_quantity || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'free_quantity', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">Unit Cost</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                placeholder="Rate"
                                                                value={ln.unit_cost}
                                                                onChange={(e) => updateGrnLine(idx, 'unit_cost', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">MRP</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                placeholder="MRP"
                                                                value={ln.mrp || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'mrp', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">Disc %</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                placeholder="0"
                                                                value={ln.discount_percent || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'discount_percent', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">Disc Amt</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                placeholder="0.00"
                                                                value={ln.discount_amount || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'discount_amount', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">CGST %</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                value={ln.cgst_percent || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'cgst_percent', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">SGST %</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                value={ln.sgst_percent || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'sgst_percent', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">IGST %</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                value={ln.igst_percent || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'igst_percent', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">Tax % (Fallback)</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9"
                                                                value={ln.tax_percent || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'tax_percent', e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </div>

                                                        <div className="lg:col-span-2">
                                                            <Label className="text-xs">Scheme</Label>
                                                            <Input
                                                                className="h-9"
                                                                value={ln.scheme || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'scheme', e.target.value)}
                                                                placeholder="ex: 10+1"
                                                            />
                                                        </div>

                                                        <div className="lg:col-span-4">
                                                            <Label className="text-xs">Remarks</Label>
                                                            <Input
                                                                className="h-9"
                                                                value={ln.remarks || ''}
                                                                onChange={(e) => updateGrnLine(idx, 'remarks', e.target.value)}
                                                                placeholder="Optional"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* line preview */}
                                                    <div className="mt-2 text-xs text-slate-600">
                                                        Line total (est.):{' '}
                                                        <span className="font-medium text-slate-900">
                                                            {money(
                                                                Math.max(
                                                                    0,
                                                                    n(ln.quantity) * n(ln.unit_cost) -
                                                                    (n(ln.discount_amount) > 0
                                                                        ? n(ln.discount_amount)
                                                                        : ((n(ln.quantity) * n(ln.unit_cost)) * n(ln.discount_percent)) / 100)
                                                                )
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* ---------------- Totals & mismatch ---------------- */}
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                        <div><span className="text-slate-500">Subtotal:</span> {money(subtotal)}</div>
                                        <div><span className="text-slate-500">Discount:</span> {money(discount)}</div>
                                        <div><span className="text-slate-500">Tax (est.):</span> {money(tax)}</div>
                                        <div><span className="text-slate-500">Extras:</span> {money(extras)}</div>
                                    </div>

                                    <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="font-medium">
                                            Calculated GRN Amount: {money(calculated)}
                                        </div>
                                        <div className="text-slate-600">
                                            Supplier Invoice: {money(invoice)}
                                        </div>
                                    </div>

                                    {mismatch && (
                                        <div className="mt-2 rounded-xl bg-amber-100 p-2 text-amber-900 text-xs flex gap-2">
                                            <AlertTriangle className="h-4 w-4 mt-0.5" />
                                            <div>
                                                <div className="font-medium">
                                                    Difference: {money(diff)} (Invoice − Calculated)
                                                </div>
                                                <div className="opacity-80">
                                                    Please enter a reason before creating GRN.
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {mismatch && (
                                        <div className="mt-3 space-y-1.5">
                                            <Label>Difference Reason (Required)</Label>
                                            <Input
                                                className="bg-white"
                                                value={grnForm.difference_reason || ''}
                                                onChange={(e) =>
                                                    setGrnForm((f) => ({ ...f, difference_reason: e.target.value }))
                                                }
                                                placeholder="Rounding / short supply / damaged / manual…"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* ---------------- Footer actions ---------------- */}
                                <div className="flex justify-between pt-1">
                                    <Button type="button" variant="outline" onClick={() => setGrnSheetOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit">
                                        Create GRN (DRAFT)
                                    </Button>
                                </div>
                            </form>
                        )
                    })()}
                </SheetContent>
            </Sheet>


            {/* Return sheet */}
            <Sheet open={returnSheetOpen} onOpenChange={setReturnSheetOpen}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="text-base font-semibold">
                            New Return (DRAFT)
                        </SheetTitle>
                        <SheetDescription className="text-xs">
                            Choose return type (to supplier / from customer / internal),
                            and specify items & quantities.
                        </SheetDescription>
                    </SheetHeader>
                    <form onSubmit={handleCreateReturn} className="space-y-4 pb-6">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Return type</Label>
                                <Select
                                    value={returnForm.type}
                                    onValueChange={val =>
                                        setReturnForm(f => ({ ...f, type: val }))
                                    }
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TO_SUPPLIER">
                                            To Supplier
                                        </SelectItem>
                                        <SelectItem value="FROM_CUSTOMER">
                                            From Customer
                                        </SelectItem>
                                        <SelectItem value="INTERNAL">
                                            Internal
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Location</Label>
                                <Select
                                    value={returnForm.location_id}
                                    onValueChange={val =>
                                        setReturnForm(f => ({ ...f, location_id: val }))
                                    }
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Select location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.map(l => (
                                            <SelectItem key={l.id} value={String(l.id)}>
                                                {l.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {returnForm.type === 'TO_SUPPLIER' && (
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label>Supplier (for return)</Label>
                                    <Select
                                        value={returnForm.supplier_id}
                                        onValueChange={val =>
                                            setReturnForm(f => ({
                                                ...f,
                                                supplier_id: val,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Select supplier" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map(s => (
                                                <SelectItem key={s.id} value={String(s.id)}>
                                                    {s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label>Reason</Label>
                                <Input
                                    value={returnForm.reason}
                                    onChange={e =>
                                        setReturnForm(f => ({
                                            ...f,
                                            reason: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Line items</Label>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={addReturnLine}
                                >
                                    <Plus className="w-3 h-3" />
                                    Add line
                                </Button>
                            </div>

                            {returnLines.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                    No lines yet. Click “Add line” or use “Create return” from
                                    Expired / Quarantine batches.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                                    {returnLines.map((ln, idx) => (
                                        <div
                                            key={idx}
                                            className="grid gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[1.6fr,1fr,0.8fr,0.8fr,0.4fr]"
                                        >
                                            {/* Item select */}
                                            <Select
                                                value={ln.item_id ? String(ln.item_id) : ''}
                                                onValueChange={val =>
                                                    updateReturnLine(idx, 'item_id', val)
                                                }
                                            >
                                                <SelectTrigger className="bg-white h-8">
                                                    <SelectValue placeholder="Item" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {items.map(it => (
                                                        <SelectItem key={it.id} value={String(it.id)}>
                                                            {it.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {/* Batch no (human) */}
                                            <Input
                                                className="h-8"
                                                placeholder="Batch no."
                                                value={ln.batch_no || ''}
                                                onChange={e =>
                                                    updateReturnLine(
                                                        idx,
                                                        'batch_no',
                                                        e.target.value
                                                    )
                                                }
                                            />

                                            {/* Quantity */}
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="h-8"
                                                placeholder="Qty"
                                                value={ln.quantity}
                                                onChange={e =>
                                                    updateReturnLine(
                                                        idx,
                                                        'quantity',
                                                        e.target.value
                                                    )
                                                }
                                            />

                                            {/* Line reason (optional) */}
                                            <Input
                                                className="h-8"
                                                placeholder="Reason"
                                                value={ln.reason}
                                                onChange={e =>
                                                    updateReturnLine(idx, 'reason', e.target.value)
                                                }
                                            />

                                            {/* Remove button */}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => removeReturnLine(idx)}
                                            >
                                                ✕
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setReturnSheetOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">Create Return (DRAFT)</Button>
                        </div>
                    </form>
                </SheetContent>
            </Sheet>
            <Dialog
                open={postModal.open}
                onOpenChange={(v) => {
                    if (!v) setPostModal({ open: false, grn: null, reason: '', posting: false })
                }}
            >
                <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Invoice mismatch — reason required</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2 text-sm">
                        <div className="rounded-xl border bg-slate-50 p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">GRN</span>
                                <span className="font-medium">{postModal.grn?.grn_number || `#${postModal.grn?.id}`}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                                <span className="text-slate-500">Difference</span>
                                <span className="font-semibold text-amber-700">
                                    ₹{Number(postModal.grn?.amount_difference || 0).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label>Difference Reason</Label>
                            <Textarea
                                value={postModal.reason}
                                onChange={(e) => setPostModal((s) => ({ ...s, reason: e.target.value }))}
                                placeholder="Rounding / short supply / damaged / manual adjustment…"
                                className="min-h-[90px]"
                            />
                            <p className="text-xs text-slate-500">
                                This will be saved into GRN and used for audit.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setPostModal({ open: false, grn: null, reason: '', posting: false })}
                            disabled={postModal.posting}
                        >
                            Cancel
                        </Button>

                        <Button
                            disabled={postModal.posting || !postModal.reason.trim()}
                            onClick={async () => {
                                const grnId = postModal.grn?.id
                                if (!grnId) return

                                setPostModal((s) => ({ ...s, posting: true }))
                                try {
                                    await handlePostGrn(grnId, postModal.reason.trim())
                                    setPostModal({ open: false, grn: null, reason: '', posting: false })
                                } finally {
                                    setPostModal((s) => ({ ...s, posting: false }))
                                }
                            }}
                        >
                            {postModal.posting ? 'Posting…' : 'Post GRN'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={grnView.open}
                onOpenChange={(v) => {
                    if (!v) setGrnView({ open: false, loading: false, data: null })
                }}
            >
                <DialogContent className="sm:max-w-3xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>GRN Details</span>
                        </DialogTitle>
                    </DialogHeader>

                    {grnView.loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-1/2" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ) : !grnView.data ? (
                        <div className="text-sm text-slate-500">No data.</div>
                    ) : (
                        <div className="space-y-4">
                            {/* Header info */}
                            <div className="rounded-xl border bg-slate-50 p-3 text-sm">
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <div className="text-xs text-slate-500">GRN</div>
                                        <div className="font-semibold">{grnView.data.grn_number}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Status</div>
                                        <Badge variant="outline" className="capitalize">
                                            {(grnView.data.status || 'DRAFT').toLowerCase()}
                                        </Badge>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Supplier</div>
                                        <div className="font-medium">{grnView.data.supplier?.name || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Location</div>
                                        <div className="font-medium">{grnView.data.location?.name || '—'}</div>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <div className="text-xs text-slate-500">Invoice</div>
                                        <div className="font-medium">
                                            {grnView.data.invoice_number || '—'}
                                            {grnView.data.invoice_date ? ` • ${formatDate(grnView.data.invoice_date)}` : ''}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Received</div>
                                        <div className="font-medium">{formatDate(grnView.data.received_date)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Notes</div>
                                        <div className="font-medium line-clamp-1">{grnView.data.notes || '—'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="border rounded-xl overflow-hidden">
                                <div className="grid grid-cols-[1.4fr,0.9fr,0.8fr,0.7fr,0.9fr] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                    <span>Item</span>
                                    <span>Batch</span>
                                    <span>Expiry</span>
                                    <span className="text-right">Qty</span>
                                    <span className="text-right">Line total</span>
                                </div>

                                <div className="max-h-[320px] overflow-auto divide-y">
                                    {(grnView.data.items || []).map((it) => (
                                        <div
                                            key={it.id}
                                            className="grid grid-cols-[1.4fr,0.9fr,0.8fr,0.7fr,0.9fr] px-3 py-2 text-xs"
                                        >
                                            <div className="text-slate-900">
                                                {it.item?.name || `Item#${it.item_id}`}
                                            </div>
                                            <div className="text-slate-700">{it.batch_no}</div>
                                            <div className="text-slate-700">
                                                {it.expiry_date ? formatDate(it.expiry_date) : '—'}
                                            </div>
                                            <div className="text-right text-slate-900">
                                                {Number(it.quantity || 0).toFixed(2)}
                                                {Number(it.free_quantity || 0) > 0 ? (
                                                    <span className="text-[11px] text-slate-500"> + {Number(it.free_quantity).toFixed(2)} free</span>
                                                ) : null}
                                            </div>
                                            <div className="text-right text-slate-900">
                                                ₹{Number(it.line_total || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                    {(grnView.data.items || []).length === 0 && (
                                        <div className="p-4 text-sm text-slate-500">No items.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setGrnView({ open: false, loading: false, data: null })}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </motion.div>
    )
}
