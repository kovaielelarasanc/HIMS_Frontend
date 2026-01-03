// FILE: src/pages/InventoryPharmacy.jsx
import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import {
  Pill,
  PackageOpen,
  AlertTriangle,
  Truck,
  RefreshCcw,
  Upload,
  ScanLine,
  Plus,
  Sparkles,
  ArrowRight,
} from "lucide-react"

import PurchaseOrdersTab from "./PurchaseOrdersTab"
import GrnTab from "./GrnTab"

import DashboardTab from "./inventoryPharmacy/DashboardTab"
import ItemsTab from "./inventoryPharmacy/ItemsTab"
import LocationsTab from "./inventoryPharmacy/LocationsTab"
import SuppliersTab from "./inventoryPharmacy/SuppliersTab"
import StockAlertsTab from "./inventoryPharmacy/StockAlertsTab"
import ReturnsTab from "./inventoryPharmacy/ReturnsTab"
import TransactionsTab from "./inventoryPharmacy/TransactionsTab"

// ✅ NOTE: Your UI helper must be .jsx if it contains JSX
import { cx, GLASS_BAR, KpiCard } from "./inventoryPharmacy/UI.jsx"

import {
  listInventoryLocations,
  listSuppliers,
  getStockSummary,
  getExpiryAlerts,
  getExpiredAlerts,
  getQuarantineStock,
  getLowStockAlerts,
  getMaxStockAlerts,
  listPurchaseOrders,
  listReturnNotes,
  createReturnNote,
  postReturnNote,
  listStockTransactions,
  createInventoryLocation,
  updateInventoryLocation,
  createSupplier,
  updateSupplier,
} from "../api/inventory"

// ---------------------------
// ✅ Robust unwrap helpers (handles Axios response OR ApiResponse OR plain array)
// ---------------------------
function unwrapAny(res) {
  if (res == null) return res

  // axios response -> { status: 200, data: ... }
  if (typeof res?.status === "number" && res?.data !== undefined) {
    return unwrapAny(res.data)
  }

  // ApiResponse -> { status: true/false, data, error }
  if (typeof res?.status === "boolean") {
    if (res.status === false) throw new Error(res?.error?.msg || "Request failed")
    return res?.data
  }

  // plain data
  return res
}

function asArray(v) {
  return Array.isArray(v) ? v : []
}

export default function InventoryPharmacy() {
  const [tab, setTab] = useState("dashboard")

  // masters
  const [locations, setLocations] = useState([])
  const [suppliers, setSuppliers] = useState([])

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
  const [activeLocationId, setActiveLocationId] = useState("ALL")

  // UX states
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [quickSheetOpen, setQuickSheetOpen] = useState(false)

  // dialogs / sheets
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [editLocation, setEditLocation] = useState(null)

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)

  const [returnSheetOpen, setReturnSheetOpen] = useState(false)
  const [returnForm, setReturnForm] = useState({
    type: "TO_SUPPLIER",
    supplier_id: "",
    location_id: "",
    reason: "",
  })
  const [returnLines, setReturnLines] = useState([])

  // ---------------- computed ----------------
  const activeLocation = useMemo(() => {
    if (!activeLocationId || activeLocationId === "ALL") return null
    return (locations || []).find((l) => String(l.id) === String(activeLocationId)) || null
  }, [locations, activeLocationId])

  console.log(activeLocation, "activeLocationactiveLocation");

  const totalActiveItems = useMemo(() => {
    const s = new Set()
    for (const row of stock || []) {
      const id = row?.item_id ?? row?.item?.id
      if (id != null) s.add(String(id))
    }
    return s.size
  }, [stock])

  const totalBatchesNearExpiry = useMemo(() => expiryAlerts.length, [expiryAlerts])
  const totalLowStockItems = useMemo(() => lowStock.length, [lowStock])
  const totalExpiredOnShelf = useMemo(() => expiredAlerts.length, [expiredAlerts])
  const totalQuarantineBatches = useMemo(() => quarantineStock.length, [quarantineStock])

  const totalPoOpen = useMemo(() => {
    return (purchaseOrders || []).filter(
      (po) => po.status !== "COMPLETED" && po.status !== "CANCELLED" && po.status !== "CLOSED"
    ).length
  }, [purchaseOrders])

  // ---------------- helpers ----------------
  const todayLocalISO = useCallback(() => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }, [])

  const handleCopy = useCallback(async (value, label = "Copied") => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(String(value))
      toast.success(label)
    } catch {
      toast.error("Unable to copy")
    }
  }, [])

  // ---------------- API loaders ----------------
  const loadMasters = useCallback(async () => {
    try {
      const [locRes, supRes] = await Promise.all([listInventoryLocations(), listSuppliers()])
      const locs = unwrapAny(locRes)
      const sups = unwrapAny(supRes)
      console.log(asArray(locs), "123 location");
      setLocations(asArray(locs))
      setSuppliers(asArray(sups))
    } catch (err) {
      console.error(err)
      toast.error(err?.message || "Failed to load masters")
      setLocations([])
      setSuppliers([])
    }
  }, [])

  const loadStock = useCallback(async (locationId) => {
    setStockLoading(true)

    const params =
      locationId && locationId !== "ALL"
        ? { location_id: Number(locationId) } // ✅ backend expects int
        : {}

    try {
      const [stockRes, expRes, expiredRes, quarantineRes, lowRes, maxRes] = await Promise.all([
        getStockSummary(params),
        getExpiryAlerts(params),
        getExpiredAlerts(params),
        getQuarantineStock(params),
        getLowStockAlerts(params),
        getMaxStockAlerts(params),
      ])

      setStock(asArray(unwrapAny(stockRes)))
      setExpiryAlerts(asArray(unwrapAny(expRes)))
      setExpiredAlerts(asArray(unwrapAny(expiredRes)))
      setQuarantineStock(asArray(unwrapAny(quarantineRes)))
      setLowStock(asArray(unwrapAny(lowRes)))
      setMaxStock(asArray(unwrapAny(maxRes)))
    } catch (err) {
      console.error(err)
      toast.error(err?.message || "Failed to load stock & alerts")
      setStock([])
      setExpiryAlerts([])
      setExpiredAlerts([])
      setQuarantineStock([])
      setLowStock([])
      setMaxStock([])
    } finally {
      setStockLoading(false)
    }
  }, [])

  const loadPurchaseOrders = useCallback(async () => {
    setPoLoading(true)
    try {
      const res = await listPurchaseOrders({})
      setPurchaseOrders(asArray(unwrapAny(res)))
    } catch (err) {
      console.error(err)
      toast.error(err?.message || "Failed to load purchase orders")
      setPurchaseOrders([])
    } finally {
      setPoLoading(false)
    }
  }, [])

  const loadReturns = useCallback(async () => {
    setReturnLoading(true)
    try {
      const res = await listReturnNotes({})
      setReturns(asArray(unwrapAny(res)))
    } catch (err) {
      console.error(err)
      toast.error(err?.message || "Failed to load returns")
      setReturns([])
    } finally {
      setReturnLoading(false)
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    setTxnLoading(true)
    try {
      const res = await listStockTransactions({})
      setTxns(asArray(unwrapAny(res)))
    } catch (err) {
      console.error(err)
      toast.error(err?.message || "Failed to load transactions")
      setTxns([])
    } finally {
      setTxnLoading(false)
    }
  }, [])

  const refreshAll = useCallback(() => {
    loadStock(activeLocationId)
    loadPurchaseOrders()
    loadReturns()
    loadTransactions()
    setLastRefreshedAt(new Date())
  }, [activeLocationId, loadPurchaseOrders, loadReturns, loadStock, loadTransactions])

  // ---------------- init (masters only once) ----------------
  useEffect(() => {
    loadMasters()
  }, [loadMasters])

  // ---------------- initial data + whenever location changes ----------------
  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocationId]) // ✅ reload when location filter changes

  // keyboard shortcuts -> send events to ItemsTab
  useEffect(() => {
    const dispatch = (name) => window.dispatchEvent(new CustomEvent(name))

    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase()
      const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable
      if (typing) return

      if (e.key === "/") {
        e.preventDefault()
        setTab("items")
        setTimeout(() => dispatch("inventory:focus-items-search"), 80)
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault()
        setTab("items")
        setTimeout(() => dispatch("inventory:new-item"), 80)
      }
      if (e.key.toLowerCase() === "u") {
        e.preventDefault()
        setTab("items")
        setTimeout(() => dispatch("inventory:bulk-upload"), 80)
      }
      if (e.key.toLowerCase() === "b") {
        e.preventDefault()
        setTab("items")
        setTimeout(() => dispatch("inventory:barcode-lookup"), 80)
      }
      if (e.key.toLowerCase() === "q") {
        e.preventDefault()
        setQuickSheetOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

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
      code: form.get("code") || "",
      name: form.get("name") || "",
      description: form.get("description") || "",
      is_active: true,
    }
    if (!payload.name) return toast.error("Location name is required")

    try {
      if (editLocation) {
        await updateInventoryLocation(editLocation.id, payload)
        toast.success("Location updated")
      } else {
        await createInventoryLocation(payload)
        toast.success("Location created")
      }
      setLocationDialogOpen(false)
      setEditLocation(null)
      await loadMasters()
      await loadStock(activeLocationId)
    } catch (err) {
      console.error(err)
      toast.error(err?.message || "Failed to save location")
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
      code: form.get("code") || "",
      name: form.get("name") || "",
      contact_person: form.get("contact_person") || "",
      phone: form.get("phone") || "",
      email: form.get("email") || "",
      gst_number: form.get("gst_number") || "",
      address: form.get("address") || "",
      is_active: true,
    }
    if (!payload.name) return toast.error("Supplier name is required")

    try {
      if (editSupplier) {
        await updateSupplier(editSupplier.id, payload)
        toast.success("Supplier updated")
      } else {
        await createSupplier(payload)
        toast.success("Supplier created")
      }
      setSupplierDialogOpen(false)
      setEditSupplier(null)
      await loadMasters()
      await loadPurchaseOrders()
      await loadReturns()
    } catch (err) {
      console.error(err)
      toast.error(err?.message || "Failed to save supplier")
    }
  }

  // ---------------- returns ----------------
  function addReturnLine() {
    setReturnLines((ls) => [...ls, { item_id: "", batch_id: "", batch_no: "", quantity: 0, reason: "" }])
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
      toast.error("Location and at least one line are required")
      return
    }

    const payload = {
      type: returnForm.type,
      supplier_id: returnForm.supplier_id ? Number(returnForm.supplier_id) : null,
      location_id: Number(returnForm.location_id),
      return_date: todayLocalISO(),
      reason: returnForm.reason || "",
      items: returnLines
        .filter((l) => l.item_id && l.quantity)
        .map((l) => ({
          item_id: Number(l.item_id),
          batch_id: l.batch_id ? Number(l.batch_id) : null,
          batch_no: l.batch_no ? String(l.batch_no).trim() : null,
          quantity: Number(l.quantity || 0),
          reason: l.reason || "",
        })),
    }

    if (payload.items.length === 0) return toast.error("Add at least one valid return line")

    try {
      await createReturnNote(payload)
      toast.success("Return created in DRAFT")
      setReturnSheetOpen(false)
      setReturnLines([])
      setReturnForm({ type: "TO_SUPPLIER", supplier_id: "", location_id: "", reason: "" })
      loadReturns()
      loadStock(activeLocationId)
    } catch (err) {
      console.error(err)
      toast.error(err?.message || "Failed to create return")
    }
  }

  async function handlePostReturn(id) {
    try {
      await postReturnNote(id)
      toast.success("Return posted & stock updated")
      loadReturns()
      loadStock(activeLocationId)
    } catch (err) {
      console.error(err)
      toast.error(err?.message || "Failed to post return")
    }
  }

  // items option for return (from stock summary)
  const itemOptions = useMemo(() => {
    const map = new Map()
    for (const row of stock || []) {
      const id = row?.item_id ?? row?.item?.id
      const name = row?.item?.name ?? row?.item_name ?? row?.name
      if (id != null && name) map.set(String(id), String(name))
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [stock])

  const dispatchToItemsTab = useCallback((evt) => {
    setTab("items")
    setTimeout(() => window.dispatchEvent(new CustomEvent(evt)), 80)
  }, [])

  return (
    <motion.div
      className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(59,130,246,0.12),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(16,185,129,0.10),transparent)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 pb-16">
        {/* Sticky Header */}
        <div className={cx("sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4", GLASS_BAR)}>
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
              <Select value={String(activeLocationId)} onValueChange={(val) => setActiveLocationId(String(val))}>
                <SelectTrigger className="w-full sm:w-64 bg-white/80 rounded-2xl">
                  <SelectValue placeholder="All locations" aria-label="Location filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All locations</SelectItem>
                  {asArray(locations).map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.code ? `${loc.code} — ${loc.name}` : loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button variant="outline" className="rounded-2xl bg-white/80 flex-1 sm:flex-none" onClick={refreshAll}>
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>

                <Button className="rounded-2xl flex-1 sm:flex-none" onClick={() => setQuickSheetOpen(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Quick
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-3 sm:gap-4 mt-5 mb-6 grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Active items" value={totalActiveItems} subtitle="Based on stock summary" icon={Pill} />
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
          <KpiCard
            title="Open POs"
            value={poLoading ? "—" : totalPoOpen}
            subtitle="Draft / sent / partial"
            icon={Truck}
            iconClass="text-emerald-600"
          />
        </div>

        {/* ✅ FULL WIDTH TABS */}
        <div className="space-y-4">
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="w-full justify-start bg-white/70 backdrop-blur border border-slate-500/70 rounded-2xl p-1 overflow-x-auto">
              <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="items">Items</TabsTrigger>
              <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="locations">Locations</TabsTrigger>
              <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="suppliers">Suppliers</TabsTrigger>
              {/* <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="stock">Stock & Alerts</TabsTrigger> */}
              <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="po">Purchase Orders</TabsTrigger>
              <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="grn">GRN</TabsTrigger>
              <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="returns">Returns</TabsTrigger>
              <TabsTrigger className="rounded-xl px-4 py-2 text-xs" value="txns">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="m-0">
              <DashboardTab
                stockLoading={stockLoading}
                expiryAlerts={expiryAlerts}
                expiredAlerts={expiredAlerts}
                lowStock={lowStock}
                maxStock={maxStock}
                quarantineStock={quarantineStock}
                activeLocation={activeLocation}
                lastRefreshedAt={lastRefreshedAt}
                startReturnForBatch={() => setReturnSheetOpen(true)}
              />
            </TabsContent>

            <TabsContent value="items" className="m-0">
              <ItemsTab />
            </TabsContent>

            <TabsContent value="locations" className="m-0">
              <LocationsTab
                locations={locations}
                onNewLocation={() => openNewLocationDialog()}
                onEditLocation={(loc) => openEditLocationDialog(loc)}
                onCopy={handleCopy}
              />
            </TabsContent>

            <TabsContent value="suppliers" className="m-0">
              <SuppliersTab
                suppliers={suppliers}
                onNewSupplier={() => openNewSupplierDialog()}
                onEditSupplier={(s) => openEditSupplierDialog(s)}
                onCopy={handleCopy}
              />
            </TabsContent>

            {/* <TabsContent value="stock" className="m-0">
              <StockAlertsTab
                stock={stock}
                quarantineStock={quarantineStock}
                stockLoading={stockLoading}
                activeLocation={activeLocation}
                startReturnForBatch={() => setReturnSheetOpen(true)}
              />
            </TabsContent> */}

            <TabsContent value="po" className="m-0">
              <PurchaseOrdersTab />
            </TabsContent>

            <TabsContent value="grn" className="m-0">
              <GrnTab />
            </TabsContent>

            <TabsContent value="returns" className="m-0">
              <ReturnsTab
                returns={returns}
                returnLoading={returnLoading}
                onNewReturn={() => setReturnSheetOpen(true)}
                onPostReturn={handlePostReturn}
              />
            </TabsContent>

            <TabsContent value="txns" className="m-0">
              <TransactionsTab txns={txns} txnLoading={txnLoading} />
            </TabsContent>
          </Tabs>
        </div>

        {/* QUICK ACTIONS SHEET */}
        <Sheet open={quickSheetOpen} onOpenChange={setQuickSheetOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-base font-semibold">Quick Actions</SheetTitle>
              <SheetDescription className="text-xs">Fast shortcuts for inventory work.</SheetDescription>
            </SheetHeader>

            <div className="space-y-2">
              <Button
                className="w-full justify-between rounded-2xl"
                onClick={() => {
                  setQuickSheetOpen(false)
                  dispatchToItemsTab("inventory:new-item")
                }}
              >
                <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Item</span>
                <span className="text-xs opacity-70">N</span>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between rounded-2xl bg-white/70"
                onClick={() => {
                  setQuickSheetOpen(false)
                  dispatchToItemsTab("inventory:bulk-upload")
                }}
              >
                <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Items</span>
                <span className="text-xs opacity-70">U</span>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between rounded-2xl bg-white/70"
                onClick={() => {
                  setQuickSheetOpen(false)
                  dispatchToItemsTab("inventory:barcode-lookup")
                }}
              >
                <span className="flex items-center gap-2"><ScanLine className="w-4 h-4" /> Barcode Lookup</span>
                <span className="text-xs opacity-70">B</span>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between rounded-2xl bg-white/70"
                onClick={() => {
                  setQuickSheetOpen(false)
                  setTab("po")
                }}
              >
                <span className="flex items-center gap-2"><Truck className="w-4 h-4" /> Purchase Orders</span>
                <ArrowRight className="w-4 h-4 opacity-70" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between rounded-2xl bg-white/70"
                onClick={() => {
                  setQuickSheetOpen(false)
                  setTab("grn")
                }}
              >
                <span className="flex items-center gap-2"><PackageOpen className="w-4 h-4" /> GRN</span>
                <ArrowRight className="w-4 h-4 opacity-70" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between rounded-2xl bg-white/70"
                onClick={() => {
                  setQuickSheetOpen(false)
                  setReturnSheetOpen(true)
                }}
              >
                <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> New Return</span>
                <ArrowRight className="w-4 h-4 opacity-70" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Location create/edit dialog */}
        <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {editLocation ? "Edit location" : "New location"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Define pharmacy/store location used for stock and GRN posting.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="loc_code">Code</Label>
                  <Input id="loc_code" name="code" defaultValue={editLocation?.code || ""} placeholder="PHARM1 / MAIN" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc_name">Name</Label>
                  <Input id="loc_name" name="name" required defaultValue={editLocation?.name || ""} placeholder="Main Pharmacy" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc_desc">Description</Label>
                <Input id="loc_desc" name="description" defaultValue={editLocation?.description || ""} placeholder="Optional description" />
              </div>
              <DialogFooter className="flex justify-between">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setLocationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl">
                  {editLocation ? "Save changes" : "Create location"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Supplier create/edit dialog */}
        <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
          <DialogContent className="max-w-xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {editSupplier ? "Edit supplier" : "New supplier"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Vendor details used for POs, GRNs, and returns.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sup_code">Code</Label>
                  <Input id="sup_code" name="code" defaultValue={editSupplier?.code || ""} placeholder="SUPP001" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="sup_name">Name</Label>
                  <Input id="sup_name" name="name" required defaultValue={editSupplier?.name || ""} placeholder="ABC Pharma Distributors" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sup_contact_person">Contact person</Label>
                  <Input id="sup_contact_person" name="contact_person" defaultValue={editSupplier?.contact_person || ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup_phone">Phone</Label>
                  <Input id="sup_phone" name="phone" defaultValue={editSupplier?.phone || ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup_email">Email</Label>
                  <Input id="sup_email" type="email" name="email" defaultValue={editSupplier?.email || ""} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sup_gst">GST number</Label>
                  <Input id="sup_gst" name="gst_number" defaultValue={editSupplier?.gst_number || ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup_address">Address</Label>
                  <Input id="sup_address" name="address" defaultValue={editSupplier?.address || ""} placeholder="City / area / address" />
                </div>
              </div>

              <DialogFooter className="flex justify-between">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setSupplierDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl">
                  {editSupplier ? "Save changes" : "Create supplier"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Return sheet */}
        <Sheet open={returnSheetOpen} onOpenChange={setReturnSheetOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-base font-semibold">New Return (DRAFT)</SheetTitle>
              <SheetDescription className="text-xs">
                Choose return type and specify items & quantities.
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
                      {asArray(locations).map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {returnForm.type === "TO_SUPPLIER" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Supplier (for return)</Label>
                    <Select value={returnForm.supplier_id} onValueChange={(val) => setReturnForm((f) => ({ ...f, supplier_id: val }))}>
                      <SelectTrigger className="bg-white rounded-2xl">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {asArray(suppliers).map((s) => (
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
                    onChange={(e) => setReturnForm((f) => ({ ...f, reason: e.target.value }))}
                    className="rounded-2xl"
                  />
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
                  <p className="text-xs text-slate-500">No lines yet. Click “Add line”.</p>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
                    {returnLines.map((ln, idx) => (
                      <div
                        key={idx}
                        className="grid gap-2 rounded-2xl border border-slate-500 p-2 bg-white/70 sm:grid-cols-[1.6fr,1fr,0.8fr,0.8fr,0.4fr]"
                      >
                        <Select value={ln.item_id ? String(ln.item_id) : ""} onValueChange={(val) => updateReturnLine(idx, "item_id", val)}>
                          <SelectTrigger className="bg-white h-10 rounded-2xl">
                            <SelectValue placeholder="Item" />
                          </SelectTrigger>
                          <SelectContent>
                            {itemOptions.map((it) => (
                              <SelectItem key={it.id} value={String(it.id)}>
                                {it.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          className="h-10 rounded-2xl"
                          placeholder="Batch no."
                          value={ln.batch_no || ""}
                          onChange={(e) => updateReturnLine(idx, "batch_no", e.target.value)}
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-10 rounded-2xl"
                          placeholder="Qty"
                          value={ln.quantity}
                          onChange={(e) => updateReturnLine(idx, "quantity", e.target.value)}
                        />
                        <Input
                          className="h-10 rounded-2xl"
                          placeholder="Reason"
                          value={ln.reason}
                          onChange={(e) => updateReturnLine(idx, "reason", e.target.value)}
                        />

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
                <Button type="submit" className="rounded-2xl">
                  Create Return (DRAFT)
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </motion.div>
  )
}
