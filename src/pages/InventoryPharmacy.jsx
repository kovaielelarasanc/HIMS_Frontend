// FILE: src/pages/InventoryPharmacy.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

import {
  Pill,
  PackageOpen,
  AlertTriangle,
  Truck,
  RefreshCcw,
  Upload,
  Download,
  Filter,
  Eye,
  Mail,
  Plus,
  Activity,
  ShieldAlert,
  Info,
  MoreVertical,
  Sparkles,
  ScanLine,
  Copy,
  Search,
  X,
  ArrowRight,
  Boxes,
} from 'lucide-react'

import ItemsBulkUploadDialog from './ItemsBulkUploadDialog'
import PurchaseOrdersTab from './PurchaseOrdersTab'
import GrnTab from './GrnTab'

import {
  listInventoryLocations,
  listSuppliers,
  listInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  getStockSummary,
  getExpiryAlerts,
  getExpiredAlerts,
  getQuarantineStock,
  getLowStockAlerts,
  getMaxStockAlerts,
  listPurchaseOrders,
  // PO helpers kept for KPI refresh; PO UI is delegated to PurchaseOrdersTab
  // changePurchaseOrderStatus,
  // downloadPoPdf,
  // markPoSent,
  listReturnNotes,
  createReturnNote,
  postReturnNote,
  listStockTransactions,
  createInventoryLocation,
  updateInventoryLocation,
  createSupplier,
  updateSupplier,
  downloadItemsTemplate,
} from '../api/inventory'

// ---------------- helpers ----------------
const cx = (...classes) => classes.filter(Boolean).join(' ')

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

const formatNumber = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function useDebouncedValue(value, delay = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

// ---------------- premium UI primitives ----------------
const GLASS_CARD =
  'rounded-3xl border border-slate-500/70 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm'
const GLASS_BAR =
  'bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-slate-500/60'

function KpiCard({ title, value, subtitle, icon: Icon, iconClass = 'text-slate-400' }) {
  return (
    <Card className={cx(GLASS_CARD, 'hover:shadow-md transition-shadow')}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-medium text-slate-500">{title}</CardTitle>
        {Icon ? <Icon className={cx('w-4 h-4', iconClass)} /> : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
        {subtitle ? <p className="text-xs text-slate-500 mt-1">{subtitle}</p> : null}
      </CardContent>
    </Card>
  )
}

function Donut({ label, value, total, accent = '#0ea5e9' }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-12 w-12 rounded-full border border-slate-500 shadow-inner"
        style={{
          background: `conic-gradient(${accent} ${pct}%, #e2e8f0 0)`,
        }}
        aria-label={`${label}: ${pct.toFixed(0)}%`}
        title={`${label}: ${pct.toFixed(0)}%`}
      />
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-900">
          {formatNumber(value)} <span className="text-xs font-normal text-slate-500">/ {formatNumber(total)}</span>
        </div>
      </div>
    </div>
  )
}

function MiniBar({ label, value, max, accent = 'bg-sky-500' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-900 font-medium">{formatNumber(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-500/60">
        <div className={cx('h-full rounded-full', accent)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ---------------- main ----------------
export default function InventoryPharmacy() {
  const [tab, setTab] = useState('dashboard')

  // masters
  const [locations, setLocations] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)

  // bulk upload dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)

  // stock & alerts
  const [stock, setStock] = useState([])
  const [expiryAlerts, setExpiryAlerts] = useState([])
  const [expiredAlerts, setExpiredAlerts] = useState([])
  const [quarantineStock, setQuarantineStock] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [maxStock, setMaxStock] = useState([])
  const [stockLoading, setStockLoading] = useState(false)

  // PO KPI + refresh
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [poLoading, setPoLoading] = useState(false)

  // returns & txns
  const [returns, setReturns] = useState([])
  const [returnLoading, setReturnLoading] = useState(false)
  const [txns, setTxns] = useState([])
  const [txnLoading, setTxnLoading] = useState(false)

  // filters
  const [activeLocationId, setActiveLocationId] = useState('ALL')
  const [itemSearch, setItemSearch] = useState('')
  const debouncedItemSearch = useDebouncedValue(itemSearch, 350)

  const [stockView, setStockView] = useState('saleable')
  const [stockQuery, setStockQuery] = useState('')

  const [txnQuery, setTxnQuery] = useState('')

  // UX states
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [quickSheetOpen, setQuickSheetOpen] = useState(false)
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false)
  const [barcodeValue, setBarcodeValue] = useState('')

  // dialogs / sheets
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [editLocation, setEditLocation] = useState(null)

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)

  const [returnSheetOpen, setReturnSheetOpen] = useState(false)
  const [returnForm, setReturnForm] = useState({
    type: 'TO_SUPPLIER',
    supplier_id: '',
    location_id: '',
    reason: '',
  })
  const [returnLines, setReturnLines] = useState([])

  // Strict flags (kept for future; used by your bulk dialog if needed)
  const [strictMode, setStrictMode] = useState(true)
  const [updateBlanks, setUpdateBlanks] = useState(false)

  const searchRef = useRef(null)

  // ---------------- convenience ----------------
  const activeLocation = useMemo(
    () => locations.find((l) => String(l.id) === String(activeLocationId)),
    [locations, activeLocationId]
  )

  const totalActiveItems = useMemo(() => items.length, [items])
  const totalBatchesNearExpiry = useMemo(() => expiryAlerts.length, [expiryAlerts])
  const totalLowStockItems = useMemo(() => lowStock.length, [lowStock])
  const totalExpiredOnShelf = useMemo(() => expiredAlerts.length, [expiredAlerts])
  const totalQuarantineBatches = useMemo(() => quarantineStock.length, [quarantineStock])

  const totalPoOpen = useMemo(() => {
    return purchaseOrders.filter(
      (po) => po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && po.status !== 'CLOSED'
    ).length
  }, [purchaseOrders])

  // ---------------- clipboard ----------------
  const handleCopy = async (value, label = 'Copied') => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(String(value))
      toast.success(label)
    } catch {
      toast.error('Unable to copy')
    }
  }

  // ---------------- load data ----------------
  useEffect(() => {
    loadMasters()
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keyboard shortcuts (extraordinary UX)
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable
      if (typing) return

      if (e.key === '/') {
        e.preventDefault()
        setTab('items')
        setTimeout(() => searchRef.current?.focus?.(), 50)
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openNewItemDialog()
      }
      if (e.key.toLowerCase() === 'u') {
        e.preventDefault()
        setBulkDialogOpen(true)
      }
      if (e.key.toLowerCase() === 'q') {
        e.preventDefault()
        setQuickSheetOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadItems(debouncedItemSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedItemSearch])

  useEffect(() => {
    loadStock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocationId])

  function refreshAll() {
    loadItems(itemSearch)
    loadStock()
    loadPurchaseOrders()
    loadReturns()
    loadTransactions()
    setLastRefreshedAt(new Date())
  }

  async function loadMasters() {
    try {
      const [locRes, supRes] = await Promise.all([listInventoryLocations(), listSuppliers()])
      setLocations(locRes.data || [])
      setSuppliers(supRes.data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load masters')
    }
  }

  async function loadItems(qOverride) {
    setItemsLoading(true)
    try {
      const res = await listInventoryItems({
        q: (qOverride ?? itemSearch) || undefined,
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
      activeLocationId && activeLocationId !== 'ALL' ? { location_id: activeLocationId } : {}
    try {
      const [stockRes, expRes, expiredRes, quarantineRes, lowRes, maxRes] = await Promise.all([
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

  // ---------------- item create / edit ----------------
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
    const form = e.currentTarget

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
    if (qrNumber) payload.qr_number = qrNumber

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
      await Promise.all([loadItems(itemSearch), loadStock()])
    } catch (err) {
      console.error('Failed to save item', err)
    }
  }

  // ---------------- location create / edit ----------------
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

  // ---------------- supplier create / edit ----------------
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
      await loadReturns()
    } catch (err) {
      console.error(err)
    }
  }

  // ---------------- download templates ----------------
  async function handleDownloadTemplate(format) {
    try {
      const res = await downloadItemsTemplate(format)
      const blob = res.data
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'xlsx' ? 'items_template.xlsx' : 'items_template.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} template downloaded`)
    } catch {
      toast.error('Failed to download template')
    }
  }

  // ---------------- returns ----------------
  function addReturnLine() {
    setReturnLines((ls) => [...ls, { item_id: '', batch_id: '', batch_no: '', quantity: 0, reason: '' }])
  }

  function updateReturnLine(idx, field, value) {
    setReturnLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  function removeReturnLine(idx) {
    setReturnLines((ls) => ls.filter((_, i) => i !== idx))
  }

  async function handleCreateReturn(e) {
    e.preventDefault()
    if (!returnForm.location_id || returnLines.length === 0) {
      toast.error('Location and at least one line are required')
      return
    }
    const payload = {
      type: returnForm.type,
      supplier_id: returnForm.supplier_id ? Number(returnForm.supplier_id) : null,
      location_id: Number(returnForm.location_id),
      return_date: new Date().toISOString().slice(0, 10),
      reason: returnForm.reason || '',
      items: returnLines
        .filter((l) => l.item_id && l.quantity)
        .map((l) => ({
          item_id: Number(l.item_id),
          batch_id: l.batch_id ? Number(l.batch_id) : null,
          batch_no: l.batch_no ? l.batch_no.trim() : null,
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
      setReturnForm({ type: 'TO_SUPPLIER', supplier_id: '', location_id: '', reason: '' })
      loadReturns()
      loadStock()
    } catch (err) {
      console.error(err)
    }
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

  // auto-open return sheet for batch (expired / quarantine)
  function startReturnForBatch(batch, mode = 'EXPIRED') {
    if (!batch) return
    const prettyName =
      batch.item?.name || batch.name || batch.item_name || `Item #${batch.item_id ?? ''}`

    const reasonLabel =
      mode === 'EXPIRED'
        ? `Expired batch ${batch.batch_no || ''} (${prettyName})`
        : `Quarantine batch ${batch.batch_no || ''} (${prettyName})`

    setReturnSheetOpen(true)
    setReturnForm((prev) => ({
      ...prev,
      type: mode === 'EXPIRED' ? 'INTERNAL' : prev.type,
      location_id: batch.location_id ? String(batch.location_id) : prev.location_id,
      reason: reasonLabel,
    }))

    setReturnLines([
      {
        item_id: String(batch.item_id),
        batch_id: String(batch.id),
        batch_no: batch.batch_no || '',
        quantity: Number(batch.current_qty ?? 0),
        reason: mode === 'EXPIRED' ? 'Expired' : 'Quarantine / quality issue',
      },
    ])
  }

  // ---------------- barcode lookup ----------------
  const handleBarcodeLookup = () => {
    const v = (barcodeValue || '').trim()
    if (!v) return toast.error('Enter barcode / item code')
    const found =
      items.find((it) => String(it.qr_number || '').trim() === v) ||
      items.find((it) => String(it.code || '').trim() === v)

    if (!found) {
      toast.error('Not found', { description: 'No item matches this barcode/code.' })
      return
    }

    setBarcodeDialogOpen(false)
    setBarcodeValue('')
    openEditItemDialog(found)
  }

  // ---------------- computed filters ----------------
  const stockQ = (stockQuery || '').toLowerCase().trim()
  const filteredStock = useMemo(() => {
    if (!stockQ) return stock
    return (stock || []).filter((r) => {
      const hay = [r.name, r.code, r.location_name].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(stockQ)
    })
  }, [stock, stockQ])

  const filteredQuarantine = useMemo(() => {
    if (!stockQ) return quarantineStock
    return (quarantineStock || []).filter((b) => {
      const hay = [
        b.item?.name,
        b.item_name,
        b.batch_no,
        b.location?.name,
        b.item?.code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(stockQ)
    })
  }, [quarantineStock, stockQ])

  const txnQ = (txnQuery || '').toLowerCase().trim()
  const filteredTxns = useMemo(() => {
    if (!txnQ) return txns
    return (txns || []).filter((t) => {
      const hay = [t.item_name, t.item_code, t.batch_no, t.location_name, t.txn_type, t.ref_display]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(txnQ)
    })
  }, [txns, txnQ])

  // ---------------- UI ----------------
  return (
    <motion.div
      className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(59,130,246,0.12),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(16,185,129,0.10),transparent)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 pb-16">
        {/* Sticky Header */}
        <div className={cx('sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4', GLASS_BAR)}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 truncate">
                  Pharmacy Inventory
                </h1>
                <Badge variant="outline" className="text-[10px] rounded-full">
                  Premium UI
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Purchase → GRN → Stock → Returns • NABH-friendly audit trail
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Select value={activeLocationId} onValueChange={(val) => setActiveLocationId(val)}>
                <SelectTrigger className="w-full sm:w-64 bg-white/80 rounded-2xl">
                  <SelectValue placeholder="All locations" aria-label="Location filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.code ? `${loc.code} — ${loc.name}` : loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" className="rounded-2xl bg-white/80" onClick={refreshAll}>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Refresh
              </Button>

              <Button className="rounded-2xl hidden sm:inline-flex" onClick={() => setQuickSheetOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                Quick
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-3 sm:gap-4 mt-5 mb-6 grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Active items" value={totalActiveItems} subtitle="Medicines & consumables" icon={Pill} />
          <KpiCard
            title="Near-expiry"
            value={totalBatchesNearExpiry}
            subtitle={`Expired: ${totalExpiredOnShelf}`}
            icon={AlertTriangle}
            iconClass="text-amber-500"
          />
          <KpiCard
            title="Low stock"
            value={totalLowStockItems}
            subtitle={`Quarantine: ${totalQuarantineBatches}`}
            icon={PackageOpen}
            iconClass="text-sky-600"
          />
          <KpiCard title="Open POs" value={poLoading ? '—' : totalPoOpen} subtitle="Draft / sent / partial" icon={Truck} iconClass="text-emerald-600" />
        </div>

        {/* Layout: main + quick panel */}
        <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
          {/* MAIN */}
          <div className="space-y-4">
            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
              <TabsList className="w-full justify-start bg-white/70 backdrop-blur border border-slate-500/70 rounded-2xl p-1 overflow-x-auto">
                <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="items">Items</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="locations">Locations</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="suppliers">Suppliers</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="stock">Stock & Alerts</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="po">Purchase Orders</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="grn">GRN</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="returns">Returns</TabsTrigger>
                <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="txns">Transactions</TabsTrigger>
              </TabsList>

              {/* DASHBOARD */}
              <TabsContent value="dashboard">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className={GLASS_CARD}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Expiry alerts
                        <Badge variant="outline" className="text-xs">{expiryAlerts.length + expiredAlerts.length}</Badge>
                      </CardTitle>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-[340px] overflow-auto">
                      {stockLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : expiryAlerts.length === 0 && expiredAlerts.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No expiry issues for {activeLocation ? activeLocation.name : 'all locations'}.
                        </p>
                      ) : (
                        <>
                          {expiredAlerts.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Expired on shelf</p>
                              <div className="space-y-1.5">
                                {expiredAlerts.slice(0, 30).map((b) => (
                                  <div
                                    key={`expired-${b.id}`}
                                    className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-900 truncate">
                                        {b.item?.name || b.name || b.item_name || `Item #${b.item_id ?? ''}`}
                                        {b.batch_no ? <span className="text-xs text-slate-500"> ({b.batch_no})</span> : null}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        Qty: {formatNumber(b.current_qty)} • Expired: {formatDate(b.expiry_date)}
                                      </p>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="rounded-2xl h-9 w-9 bg-white/70">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="rounded-2xl">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => startReturnForBatch(b, 'EXPIRED')}>
                                          Create return
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {expiryAlerts.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Near expiry</p>
                              <div className="space-y-1.5">
                                {expiryAlerts.slice(0, 30).map((b) => (
                                  <div
                                    key={`near-${b.id}`}
                                    className="flex items-center justify-between rounded-2xl border border-slate-500 px-3 py-2 bg-slate-50"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-900 truncate">
                                        {b.item?.name || b.name || b.item_name || `Item #${b.item_id ?? ''}`}
                                        {b.batch_no ? <span className="text-xs text-slate-500"> ({b.batch_no})</span> : null}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        Qty: {formatNumber(b.current_qty)} • Exp: {formatDate(b.expiry_date)}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs rounded-full">
                                      Exp: {formatDate(b.expiry_date)}
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

                  <Card className={GLASS_CARD}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          Inventory health
                          <Badge variant="outline" className="text-xs">{lowStock.length + maxStock.length}</Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Quick “NUTRYAH Health style” view of risk areas.
                        </CardDescription>
                      </div>
                      <Activity className="w-4 h-4 text-sky-500" />
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Donut
                          label="Expiry risk"
                          value={totalExpiredOnShelf}
                          total={Math.max(1, totalExpiredOnShelf + totalBatchesNearExpiry)}
                          accent="#ef4444"
                        />
                        <Donut
                          label="Stock risk"
                          value={totalLowStockItems}
                          total={Math.max(1, totalLowStockItems + maxStock.length)}
                          accent="#0ea5e9"
                        />
                      </div>

                      <div className="space-y-3 rounded-2xl border border-slate-500/70 bg-white/60 p-3">
                        <MiniBar label="Low stock items" value={lowStock.length} max={Math.max(1, lowStock.length + maxStock.length)} accent="bg-amber-500" />
                        <MiniBar label="Over-stock items" value={maxStock.length} max={Math.max(1, lowStock.length + maxStock.length)} accent="bg-sky-500" />
                        <MiniBar label="Quarantine batches" value={quarantineStock.length} max={Math.max(1, quarantineStock.length + expiredAlerts.length)} accent="bg-slate-700" />
                      </div>

                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>
                          Location: <span className="text-slate-900 font-medium">{activeLocation?.name || 'All'}</span>
                        </span>
                        <span>
                          Refreshed: <span className="text-slate-900 font-medium">{lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString() : '—'}</span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ITEMS */}
              <TabsContent value="items">
                <Card className={GLASS_CARD}>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Pharmacy items
                        <Badge variant="outline" className="text-xs">{items.length}</Badge>
                      </CardTitle>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        Medicines & consumables master (defaults only for prefill).
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Info className="h-3 w-3" />
                          Billing uses <b>Batch MRP from GRN</b>.
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Shortcuts: <span className="font-medium">/</span> focus search • <span className="font-medium">N</span> new item • <span className="font-medium">U</span> upload • <span className="font-medium">Q</span> quick actions
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="gap-1 rounded-2xl bg-white/70" onClick={() => setBarcodeDialogOpen(true)}>
                        <ScanLine className="w-3 h-3" />
                        Barcode lookup
                      </Button>

                      <Button variant="outline" size="sm" className="gap-1 rounded-2xl bg-white/70" onClick={() => setBulkDialogOpen(true)}>
                        <Upload className="w-3 h-3" />
                        Upload (CSV/Excel)
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1 rounded-2xl bg-white/70">
                            <Download className="w-3 h-3" />
                            Templates
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl">
                          <DropdownMenuLabel>Download template</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDownloadTemplate('csv')}>CSV template</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadTemplate('xlsx')}>Excel template</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button size="sm" className="gap-1 rounded-2xl" onClick={openNewItemDialog}>
                        <Plus className="w-3 h-3" />
                        New item
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 w-full">
                        <div className="relative w-full sm:max-w-md">
                          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <Input
                            ref={searchRef}
                            placeholder="Search by name / code / generic / barcode..."
                            className="w-full bg-white/80 rounded-2xl h-10 pl-9 pr-9"
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                          />
                          {itemSearch ? (
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-1 text-slate-500 hover:text-slate-900"
                              onClick={() => setItemSearch('')}
                              aria-label="Clear search"
                              title="Clear"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>

                        <Button variant="outline" className="rounded-2xl h-10 bg-white/80" onClick={() => loadItems(itemSearch)}>
                          <Filter className="w-4 h-4 mr-2" />
                          Apply
                        </Button>
                      </div>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block border border-slate-500/70 rounded-2xl overflow-hidden bg-white/70 backdrop-blur">
                      <div className="grid grid-cols-[2fr,1.2fr,1fr,1fr,0.7fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                        <span>Name / code</span>
                        <span>Generic / form</span>
                        <span>Defaults</span>
                        <span>Reorder / Max</span>
                        <span className="text-right">Actions</span>
                      </div>

                      <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                        {itemsLoading ? (
                          <div className="p-3 space-y-2">
                            <Skeleton className="h-7 w-full" />
                            <Skeleton className="h-7 w-full" />
                            <Skeleton className="h-7 w-full" />
                          </div>
                        ) : items.length === 0 ? (
                          <div className="p-6 text-sm text-slate-500 flex items-center gap-3">
                            <Boxes className="h-5 w-5 text-slate-400" />
                            No items found. Use “New item” or Upload to add catalogue.
                          </div>
                        ) : (
                          items.map((it) => (
                            <div key={it.id} className="grid grid-cols-[2fr,1.2fr,1fr,1fr,0.7fr] items-center px-3 py-2 text-xs">
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 truncate">{it.name}</div>
                                <div className="text-slate-500 flex flex-wrap items-center gap-1">
                                  <button type="button" className="hover:text-slate-900 underline-offset-2 hover:underline" onClick={() => handleCopy(it.code, 'Item code copied')}>
                                    {it.code}
                                  </button>
                                  {it.qr_number ? (
                                    <Badge variant="outline" className="text-[10px] rounded-full">
                                      {it.qr_number}
                                    </Badge>
                                  ) : null}
                                  {it.is_consumable ? <Badge variant="outline" className="text-[10px] rounded-full">Consumable</Badge> : null}
                                  {it.lasa_flag ? <Badge variant="outline" className="text-[10px] rounded-full border-rose-300 text-rose-600">LASA</Badge> : null}
                                </div>
                              </div>

                              <div className="min-w-0">
                                <div className="text-slate-700 truncate">{it.generic_name || '—'}</div>
                                <div className="text-slate-500 truncate">
                                  {it.form || '—'} {it.strength ? `• ${it.strength}` : ''}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-700">Price: ₹{formatNumber(it.default_price)}</div>
                                <div className="text-slate-500">
                                  MRP: ₹{formatNumber(it.default_mrp)} • Tax: {formatNumber(it.default_tax_percent)}%
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-700">Reorder: {formatNumber(it.reorder_level)}</div>
                                <div className="text-slate-500">Max: {formatNumber(it.max_level)}</div>
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-2xl bg-white/70">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-2xl">
                                    <DropdownMenuLabel>Item actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openEditItemDialog(it)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      View / Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCopy(it.code, 'Code copied')}>
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy code
                                    </DropdownMenuItem>
                                    {it.qr_number ? (
                                      <DropdownMenuItem onClick={() => handleCopy(it.qr_number, 'Barcode copied')}>
                                        <ScanLine className="w-4 h-4 mr-2" />
                                        Copy barcode
                                      </DropdownMenuItem>
                                    ) : null}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2">
                      {itemsLoading ? (
                        <div className="p-3 space-y-2">
                          <Skeleton className="h-16 w-full rounded-2xl" />
                          <Skeleton className="h-16 w-full rounded-2xl" />
                        </div>
                      ) : items.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500 border rounded-2xl bg-white/70">
                          No items found. Use “New item” or Upload to add catalogue.
                        </div>
                      ) : (
                        items.map((it) => (
                          <div key={it.id} className="rounded-2xl border border-slate-500/70 bg-white/70 backdrop-blur p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{it.name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-2">
                                <button type="button" className="underline-offset-2 hover:underline" onClick={() => handleCopy(it.code, 'Item code copied')}>
                                  {it.code}
                                </button>
                                {it.qr_number ? <Badge variant="outline" className="text-[10px] rounded-full">{it.qr_number}</Badge> : null}
                              </div>

                              <div className="text-xs text-slate-700 mt-2">
                                ₹{formatNumber(it.default_price)} • MRP ₹{formatNumber(it.default_mrp)} • {formatNumber(it.default_tax_percent)}% GST
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                Reorder {formatNumber(it.reorder_level)} • Max {formatNumber(it.max_level)}
                              </div>

                              <div className="flex flex-wrap gap-1 mt-2">
                                {it.is_consumable ? <Badge variant="outline" className="text-[10px] rounded-full">Consumable</Badge> : null}
                                {it.lasa_flag ? <Badge variant="outline" className="text-[10px] rounded-full border-rose-300 text-rose-600">LASA</Badge> : null}
                              </div>
                            </div>

                            <Button variant="outline" size="icon" className="rounded-2xl bg-white/70" onClick={() => openEditItemDialog(it)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Bulk Upload Dialog */}
                    <ItemsBulkUploadDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} onImported={() => loadItems(itemSearch)} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* LOCATIONS */}
              <TabsContent value="locations">
                <Card className={GLASS_CARD}>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Inventory locations
                        <Badge variant="outline" className="text-xs">{locations.length}</Badge>
                      </CardTitle>
                      <p className="text-xs text-slate-500">Define pharmacy / store locations for stock segregation.</p>
                    </div>
                    <Button size="sm" className="gap-1 rounded-2xl" onClick={openNewLocationDialog}>
                      <Plus className="w-3 h-3" />
                      New location
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="border border-slate-500/70 rounded-2xl overflow-hidden bg-white/70 backdrop-blur">
                      <div className="grid grid-cols-[0.6fr,1.4fr,1fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                        <span>Code</span>
                        <span>Name</span>
                        <span className="text-right">Actions</span>
                      </div>
                      <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                        {locations.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500">No locations defined yet.</div>
                        ) : (
                          locations.map((loc) => (
                            <div key={loc.id} className="grid grid-cols-[0.6fr,1.4fr,1fr] items-center px-3 py-2 text-xs">
                              <div className="text-slate-900 font-medium">{loc.code || '—'}</div>
                              <div className="text-slate-900">
                                {loc.name}
                                {loc.description ? <div className="text-[11px] text-slate-500">{loc.description}</div> : null}
                              </div>
                              <div className="flex items-center justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-2xl bg-white/70">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-2xl">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openEditLocationDialog(loc)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      View / Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCopy(loc.name, 'Location name copied')}>
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy name
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SUPPLIERS */}
              <TabsContent value="suppliers">
                <Card className={GLASS_CARD}>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Suppliers
                        <Badge variant="outline" className="text-xs">{suppliers.length}</Badge>
                      </CardTitle>
                      <p className="text-xs text-slate-500">Vendor master for PO, GRN, and returns.</p>
                    </div>
                    <Button size="sm" className="gap-1 rounded-2xl" onClick={openNewSupplierDialog}>
                      <Plus className="w-3 h-3" />
                      New supplier
                    </Button>
                  </CardHeader>

                  <CardContent>
                    <div className="border border-slate-500/70 rounded-2xl overflow-hidden bg-white/70 backdrop-blur">
                      <div className="grid grid-cols-[0.8fr,1.4fr,1.4fr,0.8fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                        <span>Code</span>
                        <span>Name / contact</span>
                        <span>Contact details</span>
                        <span className="text-right">Actions</span>
                      </div>

                      <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                        {suppliers.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500">No suppliers defined yet.</div>
                        ) : (
                          suppliers.map((s) => (
                            <div key={s.id} className="grid grid-cols-[0.8fr,1.4fr,1.4fr,0.8fr] items-center px-3 py-2 text-xs">
                              <div className="text-slate-900 font-medium">{s.code || '—'}</div>
                              <div className="text-slate-900">
                                {s.name}
                                {s.contact_person ? <div className="text-[11px] text-slate-500">Contact: {s.contact_person}</div> : null}
                              </div>
                              <div className="text-slate-700 text-[11px] space-y-0.5">
                                {s.phone ? <div>📞 {s.phone}</div> : null}
                                {s.email ? <div>✉️ {s.email}</div> : null}
                                {s.gst_number ? <div className="text-slate-500">GST: {s.gst_number}</div> : null}
                              </div>
                              <div className="flex items-center justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-2xl bg-white/70">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-2xl">
                                    <DropdownMenuLabel>Supplier actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openEditSupplierDialog(s)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      View / Edit
                                    </DropdownMenuItem>
                                    {s.email ? (
                                      <DropdownMenuItem onClick={() => handleCopy(s.email, 'Email copied')}>
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy email
                                      </DropdownMenuItem>
                                    ) : null}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* STOCK */}
              <TabsContent value="stock">
                <Card className={GLASS_CARD}>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Stock summary
                        <Badge variant="outline" className="text-xs">{stock.length}</Badge>
                      </CardTitle>
                      <p className="text-xs text-slate-500">Location-wise quantities with low/max indicators.</p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative w-full sm:w-72">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          placeholder="Search stock..."
                          className="bg-white/80 rounded-2xl h-10 pl-9"
                          value={stockQuery}
                          onChange={(e) => setStockQuery(e.target.value)}
                        />
                      </div>
                      <ShieldAlert className="w-4 h-4 text-slate-400 hidden sm:block" />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <Tabs value={stockView} onValueChange={setStockView} className="space-y-3">
                      <TabsList className="bg-white/70 border border-slate-500/70 rounded-2xl p-1 inline-flex gap-1">
                        <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="saleable">Saleable stock</TabsTrigger>
                        <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="quarantine">Expired & quarantine</TabsTrigger>
                      </TabsList>

                      {/* SALEABLE */}
                      <TabsContent value="saleable" className="space-y-3">
                        <div className="border border-slate-500/70 rounded-2xl overflow-hidden bg-white/70 backdrop-blur">
                          <div className="grid grid-cols-[2fr,1.2fr,1fr,0.8fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                            <span>Item</span>
                            <span>Location</span>
                            <span>Qty</span>
                            <span>Status</span>
                          </div>
                          <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                            {stockLoading ? (
                              <div className="p-3 space-y-2">
                                <Skeleton className="h-7 w-full" />
                                <Skeleton className="h-7 w-full" />
                                <Skeleton className="h-7 w-full" />
                              </div>
                            ) : filteredStock.length === 0 ? (
                              <div className="p-4 text-sm text-slate-500">No stock summary.</div>
                            ) : (
                              filteredStock.map((row) => {
                                const badges = []
                                if (row.is_low) badges.push(<Badge key="low" variant="outline" className="border-amber-300 text-amber-700 text-[10px] rounded-full">Low</Badge>)
                                if (row.is_over) badges.push(<Badge key="max" variant="outline" className="border-sky-300 text-sky-700 text-[10px] rounded-full">Max</Badge>)
                                if (!badges.length) badges.push(<Badge key="ok" variant="outline" className="text-[10px] rounded-full">OK</Badge>)

                                return (
                                  <div key={`${row.item_id}-${row.location_id || 'all'}`} className="grid grid-cols-[2fr,1.2fr,1fr,0.8fr] items-center px-3 py-2 text-xs">
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900 truncate">{row.name}</p>
                                      <p className="text-slate-500 truncate">{row.code}</p>
                                    </div>
                                    <div className="text-slate-700 truncate">{row.location_name || 'All locations'}</div>
                                    <div className="text-slate-900 font-medium">{formatNumber(row.total_qty)}</div>
                                    <div className="flex gap-1 flex-wrap">{badges}</div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      </TabsContent>

                      {/* QUARANTINE */}
                      <TabsContent value="quarantine" className="space-y-3">
                        <div className="border border-slate-500/70 rounded-2xl overflow-hidden bg-white/70 backdrop-blur">
                          <div className="grid grid-cols-[2fr,1.2fr,1fr,1fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                            <span>Item / batch</span>
                            <span>Location</span>
                            <span>Qty / expiry</span>
                            <span className="text-right">Status / actions</span>
                          </div>
                          <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                            {stockLoading ? (
                              <div className="p-3 space-y-2">
                                <Skeleton className="h-7 w-full" />
                                <Skeleton className="h-7 w-full" />
                                <Skeleton className="h-7 w-full" />
                              </div>
                            ) : filteredQuarantine.length === 0 ? (
                              <div className="p-4 text-sm text-slate-500">
                                No quarantine / expired batches for {activeLocation ? activeLocation.name : 'all locations'}.
                              </div>
                            ) : (
                              filteredQuarantine.map((b) => {
                                const status = (b.status || '').toUpperCase()
                                let badgeClass = 'text-[10px] rounded-full'
                                if (status === 'EXPIRED' || status === 'WRITTEN_OFF') badgeClass += ' border-rose-300 text-rose-700'
                                else if (status === 'QUARANTINE') badgeClass += ' border-amber-300 text-amber-700'
                                else if (status === 'RETURNED') badgeClass += ' border-slate-300 text-slate-600'

                                return (
                                  <div key={`q-${b.id}`} className="grid grid-cols-[2fr,1.2fr,1fr,1fr] items-center px-3 py-2 text-xs">
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900 truncate">
                                        {b.item?.name || b.name || b.item_name || `Item #${b.item_id ?? ''}`}
                                      </p>
                                      <p className="text-[11px] text-slate-500 truncate">
                                        Batch: {b.batch_no || '—'} • Code: {b.item?.code || '—'}
                                      </p>
                                    </div>
                                    <div className="text-slate-700 truncate">{b.location?.name || '—'}</div>
                                    <div>
                                      <p className="text-slate-900 font-medium">Qty: {formatNumber(b.current_qty)}</p>
                                      <p className="text-[11px] text-slate-500">Exp: {formatDate(b.expiry_date) || '—'}</p>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                      <Badge variant="outline" className={badgeClass}>{status || 'UNKNOWN'}</Badge>
                                      {status !== 'RETURNED' ? (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-9 px-3 rounded-2xl bg-white/70 text-[11px]"
                                          onClick={() => startReturnForBatch(b, status === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINE')}
                                        >
                                          Create return
                                        </Button>
                                      ) : null}
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

              {/* PO */}
              <TabsContent value="po">
                <Card className={GLASS_CARD}>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Purchase Orders
                        <Badge variant="outline" className="text-xs">{purchaseOrders.length}</Badge>
                      </CardTitle>
                      <p className="text-xs text-slate-500">Modern PO workflow is inside this tab.</p>
                    </div>
                    <Button className="rounded-2xl" onClick={() => toast.message('Use “New PO” inside Purchase Orders tab UI')}>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Go
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <PurchaseOrdersTab />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* GRN */}
              <TabsContent value="grn">
                <Card className={GLASS_CARD}>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        GRN
                        <Badge variant="outline" className="text-xs">Workflow</Badge>
                      </CardTitle>
                      <p className="text-xs text-slate-500">Create GRN drafts, post to update stock, and view history.</p>
                    </div>
                    <Button className="rounded-2xl" onClick={() => toast.message('Use “New GRN” inside GRN tab UI')}>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Go
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <GrnTab />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* RETURNS */}
              <TabsContent value="returns">
                <Card className={GLASS_CARD}>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Returns
                        <Badge variant="outline" className="text-xs">{returns.length}</Badge>
                      </CardTitle>
                      <p className="text-xs text-slate-500">Returns to suppliers, from customers, and internal adjustments.</p>
                    </div>
                    <Button size="sm" className="gap-1 rounded-2xl" onClick={() => setReturnSheetOpen(true)}>
                      <Plus className="w-3 h-3" />
                      New return
                    </Button>
                  </CardHeader>

                  <CardContent>
                    <div className="border border-slate-500/70 rounded-2xl overflow-hidden bg-white/70 backdrop-blur">
                      <div className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                        <span>Return no.</span>
                        <span>Type / supplier</span>
                        <span>Location / reason</span>
                        <span>Status</span>
                        <span className="text-right">Actions</span>
                      </div>

                      <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                        {returnLoading ? (
                          <div className="p-3 space-y-2">
                            <Skeleton className="h-7 w-full" />
                            <Skeleton className="h-7 w-full" />
                            <Skeleton className="h-7 w-full" />
                          </div>
                        ) : returns.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500">No returns recorded yet.</div>
                        ) : (
                          returns.map((rn) => (
                            <div key={rn.id} className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr] items-center px-3 py-2 text-xs">
                              <div>
                                <p className="font-medium text-slate-900">{rn.return_number}</p>
                                <p className="text-slate-500">Date: {formatDate(rn.return_date)}</p>
                              </div>
                              <div>
                                <p className="text-slate-900">{rn.type.replace('_', ' ')}</p>
                                <p className="text-slate-500 text-[11px]">{rn.supplier?.name || '—'}</p>
                              </div>
                              <div>
                                <p className="text-slate-900">{rn.location?.name}</p>
                                <p className="text-slate-500 text-[11px]">{rn.reason || '—'}</p>
                              </div>
                              <div>
                                <Badge variant="outline" className="text-[10px] capitalize rounded-full">
                                  {rn.status.toLowerCase()}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                {rn.status === 'DRAFT' ? (
                                  <Button variant="outline" size="sm" className="h-9 px-3 rounded-2xl bg-white/70 text-[11px]" onClick={() => handlePostReturn(rn.id)}>
                                    Post return
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-slate-400">—</span>
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

              {/* TXNS */}
              <TabsContent value="txns">
                <Card className={GLASS_CARD}>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Stock transactions
                        <Badge variant="outline" className="text-xs">{txns.length}</Badge>
                      </CardTitle>
                      <p className="text-xs text-slate-500">Audit trail of every stock movement (GRN, returns, adjustments).</p>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Search transactions..."
                        className="bg-white/80 rounded-2xl h-10 pl-9"
                        value={txnQuery}
                        onChange={(e) => setTxnQuery(e.target.value)}
                      />
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="border border-slate-500/70 rounded-2xl overflow-hidden bg-white/70 backdrop-blur">
                      <div className="grid grid-cols-[1.1fr,1.4fr,1fr,1.1fr,0.9fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                        <span>Date / type</span>
                        <span>Item / batch</span>
                        <span>Location</span>
                        <span>Qty / cost</span>
                        <span>User / ref</span>
                      </div>

                      <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                        {txnLoading ? (
                          <div className="p-3 space-y-2">
                            <Skeleton className="h-7 w-full" />
                            <Skeleton className="h-7 w-full" />
                            <Skeleton className="h-7 w-full" />
                          </div>
                        ) : filteredTxns.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500">No stock transactions found.</div>
                        ) : (
                          filteredTxns.map((tx) => (
                            <div key={tx.id} className="grid grid-cols-[1.1fr,1.4fr,1fr,1.1fr,0.9fr] items-center px-3 py-2 text-xs">
                              <div>
                                <p className="font-medium text-slate-900">{formatDate(tx.txn_time)}</p>
                                <p className="text-slate-500">
                                  {tx.txn_type}{' '}
                                  {tx.ref_display ? `• ${tx.ref_display}` : tx.ref_type && tx.ref_id ? `• ${tx.ref_type} #${tx.ref_id}` : ''}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-slate-900 truncate">{tx.item_name || `Item #${tx.item_id}`}</p>
                                <p className="text-slate-500 text-[11px] truncate">
                                  {tx.item_code ? <span>Code: {tx.item_code} • </span> : null}
                                  Batch: {tx.batch_no ? tx.batch_no : tx.batch_id ? `#${tx.batch_id}` : '—'}
                                </p>
                              </div>

                              <div className="text-slate-700 truncate">
                                {tx.location_name || (tx.location_id ? `Location #${tx.location_id}` : '—')}
                              </div>

                              <div>
                                <p className="text-slate-900">Qty: {formatNumber(tx.quantity_change)}</p>
                                <p className="text-slate-500 text-[11px]">
                                  Rate: ₹{formatNumber(tx.unit_cost)} • MRP: ₹{formatNumber(tx.mrp)}
                                </p>
                              </div>

                              <div>
                                <p className="text-slate-900 text-[11px]">
                                  {tx.user_name || (tx.user_id ? `User #${tx.user_id}` : 'System')}
                                </p>
                                <p className="text-slate-500 text-[11px] truncate">
                                  {tx.ref_display || (tx.ref_type && tx.ref_id ? `${tx.ref_type} #${tx.ref_id}` : '—')}
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
          </div>

          {/* RIGHT: QUICK ACTIONS PANEL */}
          <div className="hidden lg:block space-y-4">
            <Card className={cx(GLASS_CARD, 'sticky top-[92px]')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-xs">
                  One-click actions for faster work.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-between rounded-2xl" onClick={openNewItemDialog}>
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    New Item
                  </span>
                  <span className="text-xs opacity-70">N</span>
                </Button>

                <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => setBulkDialogOpen(true)}>
                  <span className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload Items
                  </span>
                  <span className="text-xs opacity-70">U</span>
                </Button>

                <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => setBarcodeDialogOpen(true)}>
                  <span className="flex items-center gap-2">
                    <ScanLine className="w-4 h-4" />
                    Barcode Lookup
                  </span>
                  <span className="text-xs opacity-70">/</span>
                </Button>

                <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => setTab('po')}>
                  <span className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Purchase Orders
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-70" />
                </Button>

                <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => setTab('grn')}>
                  <span className="flex items-center gap-2">
                    <PackageOpen className="w-4 h-4" />
                    GRN
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-70" />
                </Button>

                <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => setReturnSheetOpen(true)}>
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    New Return
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-70" />
                </Button>

                <div className="mt-3 rounded-2xl border border-slate-500/70 bg-white/60 p-3">
                  <div className="text-xs text-slate-500">Active location</div>
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {activeLocation?.name || 'All locations'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Refreshed: <span className="text-slate-900 font-medium">{lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString() : '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* MOBILE FAB */}
        <button
          type="button"
          className="lg:hidden fixed bottom-6 right-5 z-40 rounded-full shadow-lg border border-slate-500 bg-white/90 backdrop-blur px-4 py-3 flex items-center gap-2"
          onClick={() => setQuickSheetOpen(true)}
          aria-label="Quick actions"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">Quick</span>
        </button>

        {/* QUICK ACTIONS SHEET (mobile) */}
        <Sheet open={quickSheetOpen} onOpenChange={setQuickSheetOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-base font-semibold">Quick Actions</SheetTitle>
              <SheetDescription className="text-xs">
                Fast shortcuts for inventory work.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-2">
              <Button className="w-full justify-between rounded-2xl" onClick={() => { setQuickSheetOpen(false); openNewItemDialog(); }}>
                <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Item</span>
                <span className="text-xs opacity-70">N</span>
              </Button>

              <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => { setQuickSheetOpen(false); setBulkDialogOpen(true); }}>
                <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Items</span>
                <span className="text-xs opacity-70">U</span>
              </Button>

              <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => { setQuickSheetOpen(false); setBarcodeDialogOpen(true); }}>
                <span className="flex items-center gap-2"><ScanLine className="w-4 h-4" /> Barcode Lookup</span>
                <span className="text-xs opacity-70">/</span>
              </Button>

              <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => { setQuickSheetOpen(false); setTab('po'); }}>
                <span className="flex items-center gap-2"><Truck className="w-4 h-4" /> Purchase Orders</span>
                <ArrowRight className="w-4 h-4 opacity-70" />
              </Button>

              <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => { setQuickSheetOpen(false); setTab('grn'); }}>
                <span className="flex items-center gap-2"><PackageOpen className="w-4 h-4" /> GRN</span>
                <ArrowRight className="w-4 h-4 opacity-70" />
              </Button>

              <Button variant="outline" className="w-full justify-between rounded-2xl bg-white/70" onClick={() => { setQuickSheetOpen(false); setReturnSheetOpen(true); }}>
                <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> New Return</span>
                <ArrowRight className="w-4 h-4 opacity-70" />
              </Button>

              <div className="mt-4 rounded-2xl border border-slate-500/70 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Bulk import options</div>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Strict mode</div>
                    <div className="text-xs text-slate-500">Block commit if any row has error.</div>
                  </div>
                  <Switch checked={strictMode} onCheckedChange={setStrictMode} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Overwrite blanks</div>
                    <div className="text-xs text-slate-500">Blank values overwrite existing.</div>
                  </div>
                  <Switch checked={updateBlanks} onCheckedChange={setUpdateBlanks} />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Item create/edit dialog */}
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {editItem ? 'Edit item' : 'New item'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Maintain medicine / consumable master details, LASA flag, thresholds and barcode.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" name="code" defaultValue={editItem?.code || ''} required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="qr_number">Barcode number (scan code)</Label>
                  <Input id="qr_number" name="qr_number" placeholder="Leave blank to auto-generate" defaultValue={editItem?.qr_number || ''} />
                  <p className="text-[11px] text-slate-400 mt-0.5">Optional. Empty =&nbsp;system will create MD_XXXX.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name">Name (brand)</Label>
                  <Input id="name" name="name" defaultValue={editItem?.name || ''} required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="generic_name">Generic name</Label>
                  <Input id="generic_name" name="generic_name" defaultValue={editItem?.generic_name || ''} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="form">Form</Label>
                  <Input id="form" name="form" placeholder="tablet / capsule / syrup..." defaultValue={editItem?.form || ''} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="strength">Strength</Label>
                  <Input id="strength" name="strength" placeholder="500 mg / 5 mg/ml" defaultValue={editItem?.strength || ''} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="unit">Unit</Label>
                  <Input id="unit" name="unit" placeholder="tablet / ml / vial" defaultValue={editItem?.unit || 'tablet'} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pack_size">Pack size</Label>
                  <Input id="pack_size" name="pack_size" defaultValue={editItem?.pack_size || '10'} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input id="manufacturer" name="manufacturer" defaultValue={editItem?.manufacturer || ''} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="default_price">Default price</Label>
                  <Input id="default_price" name="default_price" type="number" step="0.01" defaultValue={editItem?.default_price || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="default_mrp">Default MRP</Label>
                  <Input id="default_mrp" name="default_mrp" type="number" step="0.01" defaultValue={editItem?.default_mrp || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="default_tax_percent">Tax %</Label>
                  <Input id="default_tax_percent" name="default_tax_percent" type="number" step="0.01" defaultValue={editItem?.default_tax_percent || ''} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reorder_level">Reorder level</Label>
                  <Input id="reorder_level" name="reorder_level" type="number" step="0.01" defaultValue={editItem?.reorder_level || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max_level">Max level</Label>
                  <Input id="max_level" name="max_level" type="number" step="0.01" defaultValue={editItem?.max_level || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="class_name">Therapeutic class</Label>
                  <Input id="class_name" name="class_name" defaultValue={editItem?.class_name || ''} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="atc_code">ATC code</Label>
                  <Input id="atc_code" name="atc_code" defaultValue={editItem?.atc_code || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hsn_code">HSN code</Label>
                  <Input id="hsn_code" name="hsn_code" defaultValue={editItem?.hsn_code || ''} />
                </div>
                <div className="flex items-center gap-4 mt-6 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_consumable" defaultChecked={editItem?.is_consumable} className="rounded border-slate-300" />
                    Consumable
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="lasa_flag" defaultChecked={editItem?.lasa_flag} className="rounded border-slate-300" />
                    LASA
                  </label>
                </div>
              </div>

              <DialogFooter className="flex justify-between">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setItemDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl">
                  {editItem ? 'Save changes' : 'Create item'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Location create/edit dialog */}
        <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">{editLocation ? 'Edit location' : 'New location'}</DialogTitle>
              <DialogDescription className="text-xs">Define pharmacy/store location used for stock and GRN posting.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="loc_code">Code</Label>
                  <Input id="loc_code" name="code" defaultValue={editLocation?.code || ''} placeholder="PHARM1 / MAIN" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc_name">Name</Label>
                  <Input id="loc_name" name="name" required defaultValue={editLocation?.name || ''} placeholder="Main Pharmacy" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc_desc">Description</Label>
                <Input id="loc_desc" name="description" defaultValue={editLocation?.description || ''} placeholder="Optional description" />
              </div>
              <DialogFooter className="flex justify-between">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setLocationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl">
                  {editLocation ? 'Save changes' : 'Create location'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Supplier create/edit dialog */}
        <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
          <DialogContent className="max-w-xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">{editSupplier ? 'Edit supplier' : 'New supplier'}</DialogTitle>
              <DialogDescription className="text-xs">Vendor details used for POs, GRNs, and returns.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sup_code">Code</Label>
                  <Input id="sup_code" name="code" defaultValue={editSupplier?.code || ''} placeholder="SUPP001" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="sup_name">Name</Label>
                  <Input id="sup_name" name="name" required defaultValue={editSupplier?.name || ''} placeholder="ABC Pharma Distributors" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sup_contact_person">Contact person</Label>
                  <Input id="sup_contact_person" name="contact_person" defaultValue={editSupplier?.contact_person || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup_phone">Phone</Label>
                  <Input id="sup_phone" name="phone" defaultValue={editSupplier?.phone || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup_email">Email</Label>
                  <Input id="sup_email" type="email" name="email" defaultValue={editSupplier?.email || ''} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sup_gst">GST number</Label>
                  <Input id="sup_gst" name="gst_number" defaultValue={editSupplier?.gst_number || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup_address">Address</Label>
                  <Input id="sup_address" name="address" defaultValue={editSupplier?.address || ''} placeholder="City / area / address" />
                </div>
              </div>

              <DialogFooter className="flex justify-between">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setSupplierDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl">
                  {editSupplier ? 'Save changes' : 'Create supplier'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Barcode lookup dialog */}
        <Dialog open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen}>
          <DialogContent className="max-w-lg rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Barcode / Code lookup</DialogTitle>
              <DialogDescription className="text-xs">
                Paste scanned barcode (qr_number) or item code to open item instantly.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Barcode / Code</Label>
                <Input
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  placeholder="Scan or type..."
                  className="rounded-2xl"
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()}
                />
              </div>

              <div className="rounded-2xl border border-slate-500/70 bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-slate-500" />
                Tip: Use scanner → it fills this input → press Enter to open the item.
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" className="rounded-2xl" onClick={() => { setBarcodeDialogOpen(false); setBarcodeValue('') }}>
                Cancel
              </Button>
              <Button className="rounded-2xl gap-2" onClick={handleBarcodeLookup}>
                <ScanLine className="h-4 w-4" />
                Find
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Return sheet */}
        <Sheet open={returnSheetOpen} onOpenChange={setReturnSheetOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-base font-semibold">New Return (DRAFT)</SheetTitle>
              <SheetDescription className="text-xs">
                Choose return type (to supplier / from customer / internal), and specify items & quantities.
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={handleCreateReturn} className="space-y-4 pb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Return type</Label>
                  <Select value={returnForm.type} onValueChange={(val) => setReturnForm((f) => ({ ...f, type: val }))}>
                    <SelectTrigger className="bg-white rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TO_SUPPLIER">To Supplier</SelectItem>
                      <SelectItem value="FROM_CUSTOMER">From Customer</SelectItem>
                      <SelectItem value="INTERNAL">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Select value={returnForm.location_id} onValueChange={(val) => setReturnForm((f) => ({ ...f, location_id: val }))}>
                    <SelectTrigger className="bg-white rounded-2xl">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
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
                    <Select value={returnForm.supplier_id} onValueChange={(val) => setReturnForm((f) => ({ ...f, supplier_id: val }))}>
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
                )}

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Reason</Label>
                  <Input value={returnForm.reason} onChange={(e) => setReturnForm((f) => ({ ...f, reason: e.target.value }))} className="rounded-2xl" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line items</Label>
                  <Button type="button" size="sm" variant="outline" className="gap-1 rounded-2xl bg-white/70" onClick={addReturnLine}>
                    <Plus className="w-3 h-3" />
                    Add line
                  </Button>
                </div>

                {returnLines.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No lines yet. Click “Add line” or use “Create return” from Expired / Quarantine batches.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
                    {returnLines.map((ln, idx) => (
                      <div key={idx} className="grid gap-2 rounded-2xl border border-slate-500 p-2 bg-white/70 sm:grid-cols-[1.6fr,1fr,0.8fr,0.8fr,0.4fr]">
                        <Select value={ln.item_id ? String(ln.item_id) : ''} onValueChange={(val) => updateReturnLine(idx, 'item_id', val)}>
                          <SelectTrigger className="bg-white h-10 rounded-2xl">
                            <SelectValue placeholder="Item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((it) => (
                              <SelectItem key={it.id} value={String(it.id)}>
                                {it.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input className="h-10 rounded-2xl" placeholder="Batch no." value={ln.batch_no || ''} onChange={(e) => updateReturnLine(idx, 'batch_no', e.target.value)} />

                        <Input type="number" min="0" step="0.01" className="h-10 rounded-2xl" placeholder="Qty" value={ln.quantity} onChange={(e) => updateReturnLine(idx, 'quantity', e.target.value)} />

                        <Input className="h-10 rounded-2xl" placeholder="Reason" value={ln.reason} onChange={(e) => updateReturnLine(idx, 'reason', e.target.value)} />

                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => removeReturnLine(idx)}>
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setReturnSheetOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl">Create Return (DRAFT)</Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </motion.div>
  )
}
