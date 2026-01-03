// FILE: src/pages/inventoryPharmacy/ItemsTab.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
} from "@/components/ui/card"
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
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

import {
    Search,
    Plus,
    Upload,
    Download,
    ScanLine,
    Pencil,
    Copy,
    RefreshCcw,
    Filter,
    X,
    Pill,
    Bandage,
} from "lucide-react"

// ✅ API (updated inventory.js)
import {
    listInventoryItems,
    createInventoryItem,
    updateInventoryItem,
    downloadItemsTemplate,
    getDrugSchedulesCatalog,
    bulkUploadItems,
} from "../../api/inventory"

// ---------------- helpers ----------------
function useDebouncedValue(value, delay = 350) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return debounced
}

function pickList(res) {
    // supports:
    // - direct array
    // - {data:[...]}
    // - {status:true,data:[...]}
    const p = res?.data ?? res
    if (Array.isArray(p)) return p
    if (p && typeof p === "object") {
        if (Array.isArray(p.data)) return p.data
        if (p.status === true && Array.isArray(p.data)) return p.data
    }
    return []
}

function toNumOrNull(v) {
    if (v === "" || v === null || v === undefined) return null
    const n = Number(v)
    // eslint-disable-next-line no-restricted-globals
    return isNaN(n) ? null : n
}

function s(v) {
    return String(v ?? "").trim()
}

function cleanDate(v) {
    const d = s(v)
    return d.length ? d : null // "YYYY-MM-DD"
}

function normalizeDateForInput(v) {
    const t = s(v)
    if (!t) return ""
    return t.length >= 10 ? t.slice(0, 10) : t
}

function parseIngredients(v) {
    if (Array.isArray(v)) return v.map((x) => s(x)).filter(Boolean)
    const str = s(v)
    if (!str) return null
    const arr = str
        .split(/[,|\n]/g)
        .map((x) => x.trim())
        .filter(Boolean)
    return arr.length ? arr : null
}

function ingredientsToString(v) {
    if (Array.isArray(v)) return v.join(", ")
    return s(v)
}

function isConsumableItem(it) {
    return it?.item_type === "CONSUMABLE" || !!it?.is_consumable
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
}

function getErrMsg(err) {
    // axios-ish + fastapi-ish
    return (
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Unknown error"
    )
}

// ---------------- form defaults (MATCH BACKEND MODEL) ----------------
const EMPTY_FORM = {
    // Core identity
    code: "",
    name: "",
    qr_number: "",

    // Classification
    item_type: "DRUG", // DRUG | CONSUMABLE
    is_consumable: false, // compatibility
    lasa_flag: false,
    is_active: true,

    // Stock metadata
    unit: "unit",
    pack_size: "1",
    reorder_level: "",
    max_level: "",

    // Supplier / procurement
    manufacturer: "",
    default_supplier_id: "",
    procurement_date: "",

    // Storage
    storage_condition: "ROOM_TEMP",

    // Defaults
    default_tax_percent: "",
    default_price: "",
    default_mrp: "",

    // Regulatory schedule
    schedule_system: "IN_DCA", // IN_DCA | US_CSA
    schedule_code: "",
    schedule_notes: "",

    // Drug fields
    generic_name: "",
    brand_name: "",
    dosage_form: "",
    strength: "",
    active_ingredients: "", // UI string
    route: "",
    therapeutic_class: "",
    prescription_status: "RX", // OTC | RX | SCHEDULED
    side_effects: "",
    drug_interactions: "",

    // Consumable fields
    material_type: "",
    sterility_status: "NON_STERILE", // STERILE | NON_STERILE
    size_dimensions: "",
    intended_use: "",
    reusable_status: "DISPOSABLE", // DISPOSABLE | REUSABLE

    // Other codes
    atc_code: "",
    hsn_code: "",
}

// ✅ Radix Select: SelectItem value MUST NOT be empty string
const NONE_VALUE = "__NONE__"

export default function ItemsTab() {
    const searchRef = useRef(null)

    // list
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)

    // search + filters
    const [q, setQ] = useState("")
    const qDebounced = useDebouncedValue(q, 350)
    const [typeFilter, setTypeFilter] = useState("ALL") // ALL | DRUG | CONSUMABLE
    const [lasaOnly, setLasaOnly] = useState(false)
    const [activeOnly, setActiveOnly] = useState(true)

    // dialogs
    const [itemDialogOpen, setItemDialogOpen] = useState(false)
    const [editItem, setEditItem] = useState(null)
    const [form, setForm] = useState({ ...EMPTY_FORM })

    const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false)
    const [barcodeValue, setBarcodeValue] = useState("")

    const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
    const [bulkFile, setBulkFile] = useState(null)
    const [strictMode, setStrictMode] = useState(true)
    const [updateBlanks, setUpdateBlanks] = useState(false)
    const [bulkUploading, setBulkUploading] = useState(false)

    // schedules dropdown catalog
    const [scheduleCatalog, setScheduleCatalog] = useState({ IN_DCA: [], US_CSA: [] })

    useEffect(() => {
        let alive = true
            ; (async () => {
                try {
                    const data = await getDrugSchedulesCatalog()
                    console.log(data?.data, "check which data");
                    if (!alive) return
                    setScheduleCatalog({
                        IN_DCA: Array.isArray(data?.data?.IN_DCA) ? data?.data.IN_DCA : [],
                        US_CSA: Array.isArray(data?.data?.US_CSA) ? data?.data.US_CSA : [],
                    })
                } catch (e) {
                    console.error("drug schedules catalog load failed", e)
                }
            })()
        return () => {
            alive = false
        }
    }, [])

    const scheduleOptions = useMemo(() => {
        const sys = form.schedule_system || "IN_DCA"
        const arr = scheduleCatalog?.[sys] || []
        return Array.isArray(arr) ? arr : []
    }, [scheduleCatalog, form.schedule_system])

    const scheduleMeta = useMemo(() => {
        const code = String(form.schedule_code || "").trim().toUpperCase()
        if (!code) return null
        return (
            scheduleOptions.find(
                (x) => String(x?.code ?? "").trim().toUpperCase() === code
            ) || null
        )
    }, [scheduleOptions, form.schedule_code])

    // ---------------- load items ----------------
    const loadItems = useCallback(async () => {
        setLoading(true)
        try {
            const params = {
                q: qDebounced || undefined,
                is_active: activeOnly ? true : undefined,

                // ✅ support both old and new filtering
                item_type: typeFilter !== "ALL" ? typeFilter : undefined,
                is_consumable:
                    typeFilter === "CONSUMABLE"
                        ? true
                        : typeFilter === "DRUG"
                            ? false
                            : undefined,

                lasa_flag: lasaOnly ? true : undefined,
            }
            const res = await listInventoryItems(params)
            setItems(pickList(res))
        } catch (err) {
            console.error(err)
            toast.error("Failed to load items", { description: getErrMsg(err) })
        } finally {
            setLoading(false)
        }
    }, [qDebounced, activeOnly, typeFilter, lasaOnly])

    useEffect(() => {
        loadItems()
    }, [loadItems])

    // ---------------- keyboard events from parent ----------------
    useEffect(() => {
        const onFocus = () => setTimeout(() => searchRef.current?.focus?.(), 60)
        const onNew = () => openNewItem()
        const onBulk = () => setBulkDialogOpen(true)
        const onBarcode = () => setBarcodeDialogOpen(true)

        window.addEventListener("inventory:focus-items-search", onFocus)
        window.addEventListener("inventory:new-item", onNew)
        window.addEventListener("inventory:bulk-upload", onBulk)
        window.addEventListener("inventory:barcode-lookup", onBarcode)
        return () => {
            window.removeEventListener("inventory:focus-items-search", onFocus)
            window.removeEventListener("inventory:new-item", onNew)
            window.removeEventListener("inventory:bulk-upload", onBulk)
            window.removeEventListener("inventory:barcode-lookup", onBarcode)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ---------------- computed ----------------
    const filteredLocal = useMemo(() => {
        return (items || []).filter((it) => {
            const isConsumable = isConsumableItem(it)
            if (typeFilter === "DRUG" && isConsumable) return false
            if (typeFilter === "CONSUMABLE" && !isConsumable) return false
            if (lasaOnly && !it?.lasa_flag) return false
            if (activeOnly && it?.is_active === false) return false
            return true
        })
    }, [items, typeFilter, lasaOnly, activeOnly])

    // ---------------- clipboard ----------------
    const handleCopy = useCallback(async (value, label = "Copied") => {
        if (!value) return
        try {
            await navigator.clipboard.writeText(String(value))
            toast.success(label)
        } catch {
            toast.error("Unable to copy")
        }
    }, [])

    // ---------------- open dialogs ----------------
    function openNewItem() {
        setEditItem(null)
        setForm({ ...EMPTY_FORM })
        setItemDialogOpen(true)
    }

    function openEditItem(item) {
        console.log(item, "seletcted edit item");
        const itemType = item?.item_type ?? (item?.is_consumable ? "CONSUMABLE" : "DRUG")
        setEditItem(item)

        setForm({
            ...EMPTY_FORM,

            // core
            code: item?.code ?? "",
            qr_number: item?.qr_number ?? "",
            name: item?.name ?? "",

            // classification
            item_type: itemType,
            is_consumable: itemType === "CONSUMABLE",
            lasa_flag: !!item?.lasa_flag,
            is_active: item?.is_active !== false,

            // stock metadata
            unit: item?.unit ?? "unit",
            pack_size: String(item?.pack_size ?? "1"),
            reorder_level: item?.reorder_level ?? "",
            max_level: item?.max_level ?? "",

            // supplier / procurement
            manufacturer: item?.manufacturer ?? "",
            default_supplier_id: item?.default_supplier_id ? String(item.default_supplier_id) : "",
            procurement_date: normalizeDateForInput(item?.procurement_date),

            // storage (support legacy storage_conditions)
            storage_condition: item?.storage_condition ?? item?.storage_conditions ?? "ROOM_TEMP",

            // defaults
            default_tax_percent: item?.default_tax_percent ?? "",
            default_price: item?.default_price ?? "",
            default_mrp: item?.default_mrp ?? "",

            // regulatory schedule
            schedule_system: item?.schedule_system ?? "IN_DCA",
            schedule_code: item?.schedule_code ? String(item.schedule_code) : "",
            schedule_notes: item?.schedule_notes ?? "",

            // drug fields (support legacy names)
            generic_name: item?.generic_name ?? "",
            brand_name: item?.brand_name ?? "",
            dosage_form: item?.dosage_form ?? item?.form ?? "",
            strength: item?.strength ?? "",
            active_ingredients: ingredientsToString(item?.active_ingredients),
            route: item?.route ?? item?.route_of_administration ?? "",
            therapeutic_class: item?.therapeutic_class ?? item?.class_name ?? "",
            prescription_status: item?.prescription_status ?? "RX",
            side_effects: item?.side_effects ?? "",
            drug_interactions: item?.drug_interactions ?? "",

            // consumable fields
            material_type: item?.material_type ?? "",
            sterility_status: item?.sterility_status ?? "NON_STERILE",
            size_dimensions: item?.size_dimensions ?? "",
            intended_use: item?.intended_use ?? "",
            reusable_status: item?.reusable_status ?? item?.reusable_disposable ?? "DISPOSABLE",

            // other codes
            atc_code: item?.atc_code ?? "",
            hsn_code: item?.hsn_code ?? "",
        })

        setItemDialogOpen(true)
    }

    // ---------------- save item ----------------
    async function handleSaveItem(e) {
        e.preventDefault()

        const itemType = form.item_type || "DRUG"
        const isDrug = itemType === "DRUG"

        const payload = {
            // core
            code: s(form.code),
            name: s(form.name),
            qr_number: s(form.qr_number) || null,

            // classification
            item_type: itemType,
            is_consumable: itemType === "CONSUMABLE", // compatibility
            lasa_flag: !!form.lasa_flag,
            is_active: !!form.is_active,

            // stock
            unit: s(form.unit) || "unit",
            pack_size: s(form.pack_size) || "1",
            reorder_level: toNumOrNull(form.reorder_level) ?? 0,
            max_level: toNumOrNull(form.max_level) ?? 0,

            // supplier / procurement
            manufacturer: s(form.manufacturer),
            default_supplier_id: toNumOrNull(form.default_supplier_id),
            procurement_date: cleanDate(form.procurement_date),

            // storage
            storage_condition: s(form.storage_condition) || "ROOM_TEMP",

            // defaults
            default_tax_percent: toNumOrNull(form.default_tax_percent) ?? 0,
            default_price: toNumOrNull(form.default_price) ?? 0,
            default_mrp: toNumOrNull(form.default_mrp) ?? 0,

            // schedule (only meaningful for drugs, but safe anyway)
            schedule_system: isDrug ? s(form.schedule_system) || "IN_DCA" : "IN_DCA",
            schedule_code: isDrug ? s(form.schedule_code) : "",
            schedule_notes: isDrug ? s(form.schedule_notes) : "",

            // drug fields
            generic_name: isDrug ? s(form.generic_name) : "",
            brand_name: isDrug ? s(form.brand_name) : "",
            dosage_form: isDrug ? s(form.dosage_form) : "",
            strength: isDrug ? s(form.strength) : "",
            active_ingredients: isDrug ? parseIngredients(form.active_ingredients) : null,
            route: isDrug ? s(form.route) : "",
            therapeutic_class: isDrug ? s(form.therapeutic_class) : "",
            prescription_status: isDrug ? s(form.prescription_status) || "RX" : "RX",
            side_effects: isDrug ? s(form.side_effects) : "",
            drug_interactions: isDrug ? s(form.drug_interactions) : "",

            // consumable fields
            material_type: !isDrug ? s(form.material_type) : "",
            sterility_status: !isDrug ? s(form.sterility_status) : "",
            size_dimensions: !isDrug ? s(form.size_dimensions) : "",
            intended_use: !isDrug ? s(form.intended_use) : "",
            reusable_status: !isDrug ? s(form.reusable_status) : "",

            // codes
            atc_code: s(form.atc_code),
            hsn_code: s(form.hsn_code),
        }

        if (!payload.code || !payload.name) {
            toast.error("Code and Name are required")
            return
        }

        try {
            if (editItem?.id) {
                console.log(payload, "payload");
                await updateInventoryItem(editItem.id, payload)
                toast.success("Item updated")
            } else {
                await createInventoryItem(payload)
                toast.success("Item created")
            }
            setItemDialogOpen(false)
            setEditItem(null)
            await loadItems()
        } catch (err) {
            console.error(err)
            toast.error("Failed to save item", { description: getErrMsg(err) })
        }
    }

    // ---------------- template download ----------------
    async function handleDownloadTemplate(format) {
        try {
            const data = await downloadItemsTemplate(format)
            const blob = data instanceof Blob ? data : new Blob([data || ""])
            downloadBlob(blob, format === "xlsx" ? "items_template.xlsx" : "items_template.csv")
            toast.success(`${format.toUpperCase()} template downloaded`)
        } catch (e) {
            console.error(e)
            toast.error("Failed to download template", { description: getErrMsg(e) })
        }
    }

    // ---------------- barcode lookup ----------------
    const handleBarcodeLookup = async () => {
        const v = s(barcodeValue)
        if (!v) return toast.error("Enter QR / item code")

        const local =
            items.find((it) => s(it?.qr_number) === v) || items.find((it) => s(it?.code) === v)

        if (local) {
            setBarcodeDialogOpen(false)
            setBarcodeValue("")
            openEditItem(local)
            return
        }

        try {
            const res = await listInventoryItems({ q: v, is_active: true })
            const list = pickList(res)
            const found =
                list.find((it) => s(it?.qr_number) === v) ||
                list.find((it) => s(it?.code) === v) ||
                list[0]

            if (!found) {
                toast.error("Not found", { description: "No item matches this QR/code." })
                return
            }

            setBarcodeDialogOpen(false)
            setBarcodeValue("")
            openEditItem(found)
        } catch (e) {
            console.error(e)
            toast.error("Lookup failed", { description: getErrMsg(e) })
        }
    }

    // ---------------- bulk import (NEW API: preview + commit) ----------------
    async function handleBulkImport() {
        if (!bulkFile) return toast.error("Choose a file first")
        setBulkUploading(true)

        try {
            const out = await bulkUploadItems(bulkFile, {
                strict: strictMode,
                update_blanks: updateBlanks,
            })

            // tolerate different shapes
            const preview = out?.preview ?? out?.data?.preview
            const commit = out?.commit ?? out?.data?.commit ?? out

            const created = Number(commit?.created || 0)
            const updated = Number(commit?.updated || 0)
            const skipped = Number(commit?.skipped || 0)
            const errs = Array.isArray(commit?.errors) ? commit.errors : []

            if (errs.length) {
                toast.warning("Imported with warnings", {
                    description: `Created ${created}, Updated ${updated}, Skipped ${skipped}, Errors ${errs.length}.`,
                })
                console.table(errs.slice(0, 20))
            } else {
                toast.success("Bulk import completed", {
                    description: `Created ${created}, Updated ${updated}, Skipped ${skipped}.`,
                })
            }

            // optional:
            // console.log("preview:", preview)

            setBulkDialogOpen(false)
            setBulkFile(null)
            await loadItems()
        } catch (e) {
            console.error(e)
            toast.error("Bulk import failed", { description: getErrMsg(e) })
        } finally {
            setBulkUploading(false)
        }
    }

    // ---------------- UI ----------------
    return (
        <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
        >
            {/* Top controls */}
            <Card className="rounded-3xl border border-slate-500/70 bg-white/70 backdrop-blur shadow-sm">
                <CardHeader className="pb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            Items
                            <Badge variant="outline" className="text-xs">
                                {filteredLocal.length}
                            </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Medicines & Consumables • Schedule fields • LASA • QR/Barcode
                        </CardDescription>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <Button
                            variant="outline"
                            className="rounded-2xl bg-white/70"
                            onClick={() => setBarcodeDialogOpen(true)}
                        >
                            <ScanLine className="w-4 h-4 mr-2" />
                            QR Lookup
                        </Button>

                        <Button
                            variant="outline"
                            className="rounded-2xl bg-white/70"
                            onClick={() => setBulkDialogOpen(true)}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Bulk
                        </Button>

                        <Button className="rounded-2xl" onClick={openNewItem}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Item
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-3">
                    {/* Search + filters */}
                    <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                ref={searchRef}
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search by name / code / qr_number..."
                                className="pl-9 rounded-2xl bg-white"
                            />
                            {q ? (
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                                    onClick={() => setQ("")}
                                    aria-label="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="w-full sm:w-48">
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="rounded-2xl bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All</SelectItem>
                                        <SelectItem value="DRUG">Medicines</SelectItem>
                                        <SelectItem value="CONSUMABLE">Consumables</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button variant="outline" className="rounded-2xl bg-white/70" onClick={loadItems}>
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>

                            <div className="flex items-center gap-2 rounded-2xl border border-slate-500/70 bg-white/70 px-3 py-2">
                                <Filter className="w-4 h-4 text-slate-600" />
                                <span className="text-xs text-slate-700">LASA</span>
                                <Switch checked={lasaOnly} onCheckedChange={setLasaOnly} />
                            </div>

                            <div className="flex items-center gap-2 rounded-2xl border border-slate-500/70 bg-white/70 px-3 py-2">
                                <span className="text-xs text-slate-700">Active only</span>
                                <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    {loading ? (
                        <div className="rounded-2xl border border-slate-500/70 bg-white/60 p-4 text-sm text-slate-600">
                            Loading items...
                        </div>
                    ) : filteredLocal.length === 0 ? (
                        <div className="rounded-2xl border border-slate-500/70 bg-white/60 p-6 text-sm text-slate-600">
                            No items found.
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-500/70 bg-white/60">
                                <div className="grid grid-cols-[140px,1.6fr,150px,120px,120px,140px] gap-2 px-4 py-3 text-xs font-semibold text-slate-600 border-b border-slate-500/70">
                                    <div>Code</div>
                                    <div>Name</div>
                                    <div>Type</div>
                                    <div>Unit</div>
                                    <div>Reorder</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                <div className="divide-y divide-slate-500/70">
                                    {filteredLocal.map((it) => {
                                        const isConsumable = isConsumableItem(it)
                                        const sch =
                                            !isConsumable && s(it?.schedule_code) ? ` • Sch: ${s(it.schedule_code)}` : ""
                                        const storage = s(it?.storage_condition)
                                            ? ` • ${s(it.storage_condition)}`
                                            : s(it?.storage_conditions)
                                                ? ` • ${s(it.storage_conditions)}`
                                                : ""

                                        return (
                                            <div
                                                key={it.id}
                                                className="grid grid-cols-[140px,1.6fr,150px,120px,120px,140px] gap-2 px-4 py-3 items-center"
                                            >
                                                <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                                    {it.code}
                                                    {it.lasa_flag ? (
                                                        <Badge className="text-[10px] rounded-full" variant="destructive">
                                                            LASA
                                                        </Badge>
                                                    ) : null}
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900 truncate">{it.name}</div>
                                                    <div className="text-xs text-slate-500 truncate">
                                                        {s(it?.generic_name) || s(it?.strength) || s(it?.manufacturer) || "—"}
                                                        {sch}
                                                        {storage}
                                                    </div>
                                                </div>

                                                <div>
                                                    <Badge variant="outline" className="rounded-full text-xs">
                                                        {isConsumable ? (
                                                            <span className="inline-flex items-center gap-1">
                                                                <Bandage className="w-3 h-3" />
                                                                Consumable
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1">
                                                                <Pill className="w-3 h-3" />
                                                                Medicine
                                                            </span>
                                                        )}
                                                    </Badge>
                                                </div>

                                                <div className="text-sm text-slate-700">{it.unit || "—"}</div>
                                                <div className="text-sm text-slate-700">{it.reorder_level ?? "—"}</div>

                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="rounded-2xl bg-white/70"
                                                        onClick={() => handleCopy(it.code, "Code copied")}
                                                    >
                                                        <Copy className="w-4 h-4 mr-2" />
                                                        Copy
                                                    </Button>
                                                    <Button size="sm" className="rounded-2xl" onClick={() => openEditItem(it)}>
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Edit
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Mobile cards */}
                            <div className="lg:hidden space-y-2">
                                {filteredLocal.map((it) => {
                                    const isConsumable = isConsumableItem(it)
                                    const sch =
                                        !isConsumable && s(it?.schedule_code) ? ` • Sch: ${s(it.schedule_code)}` : ""

                                    return (
                                        <div
                                            key={it.id}
                                            className="rounded-2xl border border-slate-500/70 bg-white/70 p-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-semibold text-slate-900 truncate">{it.name}</div>
                                                        {it.lasa_flag ? (
                                                            <Badge className="text-[10px] rounded-full" variant="destructive">
                                                                LASA
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-xs text-slate-500 truncate">
                                                        {it.code}
                                                        {s(it?.generic_name) ? ` • ${s(it.generic_name)}` : ""}
                                                        {sch}
                                                    </div>
                                                </div>

                                                <Badge variant="outline" className="rounded-full text-xs">
                                                    {isConsumable ? "Consumable" : "Medicine"}
                                                </Badge>
                                            </div>

                                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                                                <div>
                                                    <span className="text-slate-500">Unit:</span>{" "}
                                                    <span className="text-slate-900 font-medium">{it.unit || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Reorder:</span>{" "}
                                                    <span className="text-slate-900 font-medium">{it.reorder_level ?? "—"}</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="rounded-2xl bg-white/70 flex-1"
                                                    onClick={() => handleCopy(it.code, "Code copied")}
                                                >
                                                    <Copy className="w-4 h-4 mr-2" />
                                                    Copy
                                                </Button>
                                                <Button className="rounded-2xl flex-1" onClick={() => openEditItem(it)}>
                                                    <Pencil className="w-4 h-4 mr-2" />
                                                    Edit
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* -------- Item create/edit dialog -------- */}
            <Dialog
                open={itemDialogOpen}
                onOpenChange={(open) => {
                    setItemDialogOpen(open)
                    if (!open) {
                        setEditItem(null)
                        setForm({ ...EMPTY_FORM })
                    }
                }}
            >
                <DialogContent
                    className="
            w-[calc(100vw-1.25rem)]
            sm:w-full sm:max-w-3xl
            max-h-[calc(100dvh-1.25rem)]
            p-0 overflow-hidden
            rounded-2xl sm:rounded-3xl
          "
                >
                    <div className="flex h-full max-h-[calc(100dvh-1.25rem)] flex-col">
                        {/* Header */}
                        <div className="border-b bg-white/80 backdrop-blur px-4 py-4 sm:px-6">
                            <DialogHeader className="space-y-1 pr-10">
                                <DialogTitle className="text-base font-semibold">
                                    {editItem ? "Edit item" : "New item"}
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Matches backend InventoryItem fields (type, storage_condition, schedule,
                                    supplier/procurement, ATC/HSN).
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <form onSubmit={handleSaveItem} className="flex min-h-0 flex-1 flex-col">
                            {/* Body */}
                            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
                                {/* Core */}
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label>Code *</Label>
                                        <Input
                                            value={form.code ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                            className="rounded-2xl"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>QR / Barcode (qr_number)</Label>
                                        <Input
                                            value={form.qr_number ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, qr_number: e.target.value }))}
                                            placeholder="Optional"
                                            className="rounded-2xl"
                                        />
                                        <p className="text-[11px] text-slate-400">Unique (optional)</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Name *</Label>
                                        <Input
                                            value={form.name ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                            className="rounded-2xl"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Item Type</Label>
                                        <Select
                                            value={form.item_type ?? "DRUG"}
                                            onValueChange={(val) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    item_type: val,
                                                    is_consumable: val === "CONSUMABLE",
                                                    // helpful: reset schedule when switching away from DRUG
                                                    schedule_code: val === "DRUG" ? f.schedule_code : "",
                                                    schedule_notes: val === "DRUG" ? f.schedule_notes : "",
                                                }))
                                            }
                                        >
                                            <SelectTrigger className="rounded-2xl bg-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DRUG">Medicine (DRUG)</SelectItem>
                                                <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Unit</Label>
                                        <Input
                                            value={form.unit ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                                            className="rounded-2xl"
                                            placeholder="unit / box / vial"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Pack size</Label>
                                        <Input
                                            value={form.pack_size ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, pack_size: e.target.value }))}
                                            className="rounded-2xl"
                                            placeholder="1 / 10 / 100"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label>Manufacturer</Label>
                                        <Input
                                            value={form.manufacturer ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                                            className="rounded-2xl"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Default supplier ID</Label>
                                        <Input
                                            type="number"
                                            value={form.default_supplier_id ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, default_supplier_id: e.target.value }))}
                                            className="rounded-2xl"
                                            placeholder="Optional"
                                        />
                                        <p className="text-[11px] text-slate-400">Maps to default_supplier_id</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Procurement date</Label>
                                        <Input
                                            type="date"
                                            value={form.procurement_date ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, procurement_date: e.target.value }))}
                                            className="rounded-2xl"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label>Reorder level</Label>
                                        <Input
                                            type="number"
                                            step="0.0001"
                                            value={form.reorder_level ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
                                            className="rounded-2xl"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Max level</Label>
                                        <Input
                                            type="number"
                                            step="0.0001"
                                            value={form.max_level ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, max_level: e.target.value }))}
                                            className="rounded-2xl"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Storage condition</Label>
                                        <Select
                                            value={form.storage_condition ?? "ROOM_TEMP"}
                                            onValueChange={(val) => setForm((f) => ({ ...f, storage_condition: val }))}
                                        >
                                            <SelectTrigger className="rounded-2xl bg-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ROOM_TEMP">ROOM_TEMP</SelectItem>
                                                <SelectItem value="REFRIGERATED">REFRIGERATED</SelectItem>
                                                <SelectItem value="AWAY_FROM_LIGHT">AWAY_FROM_LIGHT</SelectItem>
                                                <SelectItem value="FROZEN">FROZEN</SelectItem>
                                                <SelectItem value="OTHER">OTHER</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label>Default price</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.default_price ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, default_price: e.target.value }))}
                                            className="rounded-2xl"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Default MRP</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.default_mrp ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, default_mrp: e.target.value }))}
                                            className="rounded-2xl"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Tax %</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.default_tax_percent ?? ""}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, default_tax_percent: e.target.value }))
                                            }
                                            className="rounded-2xl"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label>ATC code</Label>
                                        <Input
                                            value={form.atc_code ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, atc_code: e.target.value }))}
                                            className="rounded-2xl"
                                            placeholder="Optional"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>HSN code</Label>
                                        <Input
                                            value={form.hsn_code ?? ""}
                                            onChange={(e) => setForm((f) => ({ ...f, hsn_code: e.target.value }))}
                                            className="rounded-2xl"
                                            placeholder="Optional"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between rounded-2xl border border-slate-500/70 bg-white/70 px-3 py-2">
                                        <div>
                                            <div className="text-sm font-medium text-slate-900">Active</div>
                                            <div className="text-xs text-slate-500">Hide item if off</div>
                                        </div>
                                        <Switch
                                            checked={!!form.is_active}
                                            onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-2xl border border-slate-500/70 bg-white/70 px-3 py-2">
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">LASA flag</div>
                                        <div className="text-xs text-slate-500">Look-Alike Sound-Alike warning</div>
                                    </div>
                                    <Switch
                                        checked={!!form.lasa_flag}
                                        onCheckedChange={(v) => setForm((f) => ({ ...f, lasa_flag: v }))}
                                    />
                                </div>

                                {/* Tabs */}
                                <Tabs
                                    key={form.item_type} // resets when type changes
                                    defaultValue={form.item_type === "CONSUMABLE" ? "consumable" : "drug"}
                                    className="space-y-3"
                                >
                                    <TabsList className="w-full justify-start bg-white/70 backdrop-blur border border-slate-500/70 rounded-2xl p-1 overflow-x-auto">
                                        <TabsTrigger className="shrink-0 rounded-xl px-4 py-2 text-xs" value="drug">
                                            Drug fields
                                        </TabsTrigger>
                                        <TabsTrigger
                                            className="shrink-0 rounded-xl px-4 py-2 text-xs"
                                            value="consumable"
                                        >
                                            Consumable fields
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Drug */}
                                    <TabsContent value="drug" className="space-y-3">
                                        {form.item_type !== "DRUG" ? (
                                            <div className="rounded-2xl border border-slate-500/70 bg-white/60 p-3 text-xs text-slate-600">
                                                Switch <b>Item Type</b> to <b>DRUG</b> to use these fields.
                                            </div>
                                        ) : null}

                                        <div className="rounded-2xl border border-slate-500/70 bg-white/60 p-3 space-y-3">
                                            {/* Regulatory schedule */}
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                <div className="space-y-1.5">
                                                    <Label>Schedule system</Label>
                                                    <Select
                                                        value={form.schedule_system ?? "IN_DCA"}
                                                        onValueChange={(val) =>
                                                            setForm((f) => ({
                                                                ...f,
                                                                schedule_system: val,
                                                                schedule_code: "",
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger className="rounded-2xl bg-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="IN_DCA">IN_DCA (India)</SelectItem>
                                                            <SelectItem value="US_CSA">US_CSA (USA)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Schedule code</Label>
                                                    <Select
                                                        value={form.schedule_code ? String(form.schedule_code) : NONE_VALUE}
                                                        onValueChange={(val) =>
                                                            setForm((f) => ({
                                                                ...f,
                                                                schedule_code: val === NONE_VALUE ? "" : val,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger className="rounded-2xl bg-white">
                                                            <SelectValue placeholder="Select schedule (optional)" />
                                                        </SelectTrigger>
                                                        <SelectContent className="max-h-72">
                                                            <SelectItem value={NONE_VALUE}>None</SelectItem>
                                                            {scheduleOptions.map((opt) => {
                                                                const code = String(opt?.code ?? "").trim()
                                                                if (!code) return null
                                                                return (
                                                                    <SelectItem key={code} value={code}>
                                                                        {code} — {opt?.label || opt?.name || "Schedule"}
                                                                    </SelectItem>
                                                                )
                                                            })}
                                                        </SelectContent>
                                                    </Select>

                                                    {scheduleMeta ? (
                                                        <div className="mt-2 rounded-xl border border-slate-500/50 bg-white/70 px-3 py-2">
                                                            <div className="text-xs font-medium text-slate-900">
                                                                {scheduleMeta.label || scheduleMeta.name || scheduleMeta.code}
                                                            </div>
                                                            <div className="text-[11px] text-slate-600 mt-0.5">
                                                                {scheduleMeta.desc || scheduleMeta.description || "—"}
                                                            </div>

                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                {scheduleMeta.requires_prescription ? (
                                                                    <Badge variant="outline" className="rounded-full text-[10px]">
                                                                        RX required
                                                                    </Badge>
                                                                ) : null}
                                                                {scheduleMeta.requires_register ? (
                                                                    <Badge variant="outline" className="rounded-full text-[10px]">
                                                                        Register
                                                                    </Badge>
                                                                ) : null}
                                                                {scheduleMeta.strict_storage ? (
                                                                    <Badge variant="outline" className="rounded-full text-[10px]">
                                                                        Strict storage
                                                                    </Badge>
                                                                ) : null}
                                                                {scheduleMeta.blocks_dispense ? (
                                                                    <Badge variant="destructive" className="rounded-full text-[10px]">
                                                                        Blocks dispense
                                                                    </Badge>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                                                    <Label>Schedule notes</Label>
                                                    <Input
                                                        value={form.schedule_notes ?? ""}
                                                        onChange={(e) => setForm((f) => ({ ...f, schedule_notes: e.target.value }))}
                                                        className="rounded-2xl"
                                                        placeholder="Optional internal notes"
                                                    />
                                                </div>
                                            </div>

                                            {/* Drug fields */}
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                <div className="space-y-1.5">
                                                    <Label>Generic name</Label>
                                                    <Input
                                                        value={form.generic_name ?? ""}
                                                        onChange={(e) => setForm((f) => ({ ...f, generic_name: e.target.value }))}
                                                        className="rounded-2xl"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Brand name</Label>
                                                    <Input
                                                        value={form.brand_name ?? ""}
                                                        onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))}
                                                        className="rounded-2xl"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Dosage form</Label>
                                                    <Input
                                                        value={form.dosage_form ?? ""}
                                                        onChange={(e) => setForm((f) => ({ ...f, dosage_form: e.target.value }))}
                                                        className="rounded-2xl"
                                                        placeholder="tablet/capsule/injection"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Strength</Label>
                                                    <Input
                                                        value={form.strength ?? ""}
                                                        onChange={(e) => setForm((f) => ({ ...f, strength: e.target.value }))}
                                                        className="rounded-2xl"
                                                        placeholder="500 mg / 10 ml"
                                                    />
                                                </div>

                                                <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                                                    <Label>Active ingredients (comma / new line)</Label>
                                                    <Input
                                                        value={form.active_ingredients ?? ""}
                                                        onChange={(e) =>
                                                            setForm((f) => ({ ...f, active_ingredients: e.target.value }))
                                                        }
                                                        className="rounded-2xl"
                                                        placeholder="Paracetamol, Caffeine"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Route</Label>
                                                    <Input
                                                        value={form.route ?? ""}
                                                        onChange={(e) => setForm((f) => ({ ...f, route: e.target.value }))}
                                                        className="rounded-2xl"
                                                        placeholder="oral / IV / topical"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Therapeutic class</Label>
                                                    <Input
                                                        value={form.therapeutic_class ?? ""}
                                                        onChange={(e) =>
                                                            setForm((f) => ({ ...f, therapeutic_class: e.target.value }))
                                                        }
                                                        className="rounded-2xl"
                                                        placeholder="antibiotic / analgesic"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Prescription status</Label>
                                                    <Select
                                                        value={form.prescription_status ?? "RX"}
                                                        onValueChange={(val) =>
                                                            setForm((f) => ({ ...f, prescription_status: val }))
                                                        }
                                                    >
                                                        <SelectTrigger className="rounded-2xl bg-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="RX">RX</SelectItem>
                                                            <SelectItem value="OTC">OTC</SelectItem>
                                                            <SelectItem value="SCHEDULED">SCHEDULED</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                                                    <Label>Side effects</Label>
                                                    <Textarea
                                                        value={form.side_effects ?? ""}
                                                        onChange={(e) => setForm((f) => ({ ...f, side_effects: e.target.value }))}
                                                        className="rounded-2xl min-h-[80px]"
                                                        placeholder="Optional"
                                                    />
                                                </div>

                                                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                                                    <Label>Drug interactions</Label>
                                                    <Textarea
                                                        value={form.drug_interactions ?? ""}
                                                        onChange={(e) =>
                                                            setForm((f) => ({ ...f, drug_interactions: e.target.value }))
                                                        }
                                                        className="rounded-2xl min-h-[80px]"
                                                        placeholder="Optional"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* Consumable */}
                                    <TabsContent value="consumable" className="space-y-3">
                                        {form.item_type !== "CONSUMABLE" ? (
                                            <div className="rounded-2xl border border-slate-500/70 bg-white/60 p-3 text-xs text-slate-600">
                                                Switch <b>Item Type</b> to <b>CONSUMABLE</b> to use these fields.
                                            </div>
                                        ) : null}

                                        <div className="rounded-2xl border border-slate-500/70 bg-white/60 p-3">
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <Label>Material type</Label>
                                                    <Input
                                                        value={form.material_type ?? ""}
                                                        onChange={(e) =>
                                                            setForm((f) => ({ ...f, material_type: e.target.value }))
                                                        }
                                                        className="rounded-2xl"
                                                        placeholder="latex/plastic/cotton"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Sterility status</Label>
                                                    <Select
                                                        value={form.sterility_status ?? "NON_STERILE"}
                                                        onValueChange={(val) =>
                                                            setForm((f) => ({ ...f, sterility_status: val }))
                                                        }
                                                    >
                                                        <SelectTrigger className="rounded-2xl bg-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="STERILE">STERILE</SelectItem>
                                                            <SelectItem value="NON_STERILE">NON_STERILE</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Size / dimensions</Label>
                                                    <Input
                                                        value={form.size_dimensions ?? ""}
                                                        onChange={(e) =>
                                                            setForm((f) => ({ ...f, size_dimensions: e.target.value }))
                                                        }
                                                        className="rounded-2xl"
                                                        placeholder="M / 10ml / 18G / 4x4"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Reusable status</Label>
                                                    <Select
                                                        value={form.reusable_status ?? "DISPOSABLE"}
                                                        onValueChange={(val) =>
                                                            setForm((f) => ({ ...f, reusable_status: val }))
                                                        }
                                                    >
                                                        <SelectTrigger className="rounded-2xl bg-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="DISPOSABLE">DISPOSABLE</SelectItem>
                                                            <SelectItem value="REUSABLE">REUSABLE</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5 sm:col-span-2">
                                                    <Label>Intended use</Label>
                                                    <Textarea
                                                        value={form.intended_use ?? ""}
                                                        onChange={(e) => setForm((f) => ({ ...f, intended_use: e.target.value }))}
                                                        className="rounded-2xl min-h-[80px]"
                                                        placeholder="brief description"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>

                            {/* Footer */}
                            <div className="border-t bg-white/80 backdrop-blur px-4 py-3 sm:px-6">
                                <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-2xl w-full sm:w-auto"
                                        onClick={() => setItemDialogOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="rounded-2xl w-full sm:w-auto">
                                        {editItem ? "Save changes" : "Create item"}
                                    </Button>
                                </DialogFooter>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>

            {/* -------- Barcode lookup -------- */}
            <Dialog open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen}>
                <DialogContent className="max-w-lg rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">QR / Code lookup</DialogTitle>
                        <DialogDescription className="text-xs">
                            Paste scanned qr_number (barcode/QR) or item code to open item instantly.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>QR / Code</Label>
                            <Input
                                value={barcodeValue}
                                onChange={(e) => setBarcodeValue(e.target.value)}
                                placeholder="Scan or type..."
                                className="rounded-2xl"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        handleBarcodeLookup()
                                    }
                                }}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="rounded-2xl flex-1"
                                onClick={() => {
                                    setBarcodeDialogOpen(false)
                                    setBarcodeValue("")
                                }}
                            >
                                Cancel
                            </Button>
                            <Button className="rounded-2xl flex-1 gap-2" onClick={handleBarcodeLookup}>
                                <ScanLine className="h-4 w-4" />
                                Find
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* -------- Bulk import -------- */}
            <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogContent className="max-w-xl rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">Bulk upload items</DialogTitle>
                        <DialogDescription className="text-xs">
                            Download template → fill → upload. Strict mode blocks commit if any row has error.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                className="rounded-2xl bg-white/70"
                                onClick={() => handleDownloadTemplate("xlsx")}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                XLSX template
                            </Button>
                            <Button
                                variant="outline"
                                className="rounded-2xl bg-white/70"
                                onClick={() => handleDownloadTemplate("csv")}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                CSV template
                            </Button>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Upload file</Label>
                            <Input
                                type="file"
                                accept=".xlsx,.csv"
                                className="rounded-2xl bg-white"
                                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                            />
                            <p className="text-[11px] text-slate-500">
                                Endpoint used:{" "}
                                <span className="font-mono">
                                    POST /api/inventory/items/bulk-upload/preview + commit
                                </span>
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-500/70 bg-white/60 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-slate-900">Strict mode</div>
                                    <div className="text-xs text-slate-500">Block commit if any row has error.</div>
                                </div>
                                <Switch checked={strictMode} onCheckedChange={setStrictMode} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-slate-900">Overwrite blanks</div>
                                    <div className="text-xs text-slate-500">Blank values overwrite existing.</div>
                                </div>
                                <Switch checked={updateBlanks} onCheckedChange={setUpdateBlanks} />
                            </div>
                        </div>

                        <DialogFooter className="flex justify-between">
                            <Button
                                variant="outline"
                                className="rounded-2xl"
                                onClick={() => {
                                    setBulkDialogOpen(false)
                                    setBulkFile(null)
                                }}
                            >
                                Close
                            </Button>
                            <Button
                                className="rounded-2xl"
                                disabled={!bulkFile || bulkUploading}
                                onClick={handleBulkImport}
                            >
                                {bulkUploading ? "Uploading..." : "Upload"}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}
