// FILE: src/billing/BillingAddItem.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
    billingGetCase,
    billingMetaParticulars,
    billingParticularOptions,
    billingParticularAdd,
    billingListInvoices,
    billingCreateInvoice,
    billingAddChargeItemLine,
    isCanceledError,
} from "@/api/billings"
import { listChargeItems } from "@/api/chargeMaster"
import { Button, Card, CardBody, CardHeader, Field, Input, Select } from "./_ui"
import { ArrowLeft, PlusCircle, RefreshCcw, Search, Trash2, RotateCcw } from "lucide-react"

const cx = (...a) => a.filter(Boolean).join(" ")

const CHARGE_CATEGORIES = [
    { value: "ADM", label: "Admission" },
    { value: "DIET", label: "Dietary" },
    { value: "MISC", label: "Misc" },
    { value: "BLOOD", label: "Blood Bank" },
]

// Particular codes that SHOULD show Charge Master workflow
const CHARGE_PARTICULAR_CODES = new Set(["MIS", "MISC", "ADM", "DIET", "BLOOD"])

function num(v, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function isLikelyItemObj(x) {
    if (!x || typeof x !== "object") return false
    return x.id != null && (x.name != null || x.label != null || x.code != null || x.title != null)
}

function findAnyArrayDeep(obj, depth = 3) {
    if (!obj || typeof obj !== "object" || depth < 0) return null
    if (Array.isArray(obj) && obj.some(isLikelyItemObj)) return obj

    const keys = [
        "items",
        "results",
        "rows",
        "tests",
        "services",
        "particulars",
        "charge_items",
        "lab_tests",
        "radiology_tests",
        "procedures",
        "surgeries",
        "beds",
        "list",
    ]
    for (const k of keys) {
        const arr = obj?.[k]
        if (Array.isArray(arr) && arr.some(isLikelyItemObj)) return arr
    }
    for (const k of keys) {
        const arr = obj?.options?.[k]
        if (Array.isArray(arr) && arr.some(isLikelyItemObj)) return arr
    }
    for (const v of Object.values(obj)) {
        if (Array.isArray(v) && v.some(isLikelyItemObj)) return v
        if (v && typeof v === "object") {
            const found = findAnyArrayDeep(v, depth - 1)
            if (found) return found
        }
    }
    return null
}

function getItemLabel(it) {
    return (
        it?.label ||
        it?.name ||
        it?.title ||
        (it?.code ? `${it.code} - ${(it?.name || it?.title || "")}`.trim() : "") ||
        String(it?.id ?? "")
    )
}

function getItemPrice(it) {
    const v =
        it?.price ??
        it?.suggested_rate ??
        it?.suggestedRate ??
        it?.suggested_amount ??
        it?.rate ??
        it?.amount ??
        it?.default_cost ??
        it?.total_fixed_cost ??
        it?.cost_per_hour ??
        it?.hourly_cost ??
        it?.base_fee ??
        0
    return num(v, 0)
}

function getItemGst(it) {
    const v = it?.gst_rate ?? it?.gst ?? it?.tax_rate ?? it?.cgst_pct ?? it?.sgst_pct ?? 0
    return num(v, 0)
}

function mkRowKey() {
    try {
        if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
    } catch { }
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function shouldAutofillPrice(priceStr, autoFill) {
    const p = num(priceStr, 0)
    return autoFill && p > 0
}

function uniqUpper(list) {
    const set = new Set()
    for (const x of list || []) {
        const s = String(x || "").trim()
        if (!s) continue
        set.add(s.toUpperCase())
    }
    return Array.from(set).sort()
}

export default function BillingAddItem() {
    const { caseId } = useParams()
    const nav = useNavigate()

    const abortBaseRef = useRef(null)
    const debounceRef = useRef(null)

    const [loading, setLoading] = useState(true)
    const [caseRow, setCaseRow] = useState(null)

    const [particulars, setParticulars] = useState([])
    const [code, setCode] = useState("ROOM")

    const [opts, setOpts] = useState(null)
    const [optLoading, setOptLoading] = useState(false)

    const current = useMemo(() => particulars.find((p) => p.code === code) || null, [particulars, code])

    const codeUpper = useMemo(() => String(code || "").trim().toUpperCase(), [code])
    const kindRaw = useMemo(() => String(current?.kind || "").toUpperCase(), [current])

    // Try to read a "module" hint if backend provides it in meta particulars
    const particularModule = useMemo(() => {
        const v =
            current?.module ||
            current?.module_code ||
            current?.moduleCode ||
            current?.module_header ||
            current?.moduleHeader ||
            ""
        return String(v || "").trim().toUpperCase()
    }, [current])

    /**
     * ✅ Correct workflow gate:
     * Show Charge Master UI ONLY when:
     * - particular code is MIS/MISC/ADM/DIET/BLOOD OR
     * - backend kind indicates CHARGE
     */
    const isChargeParticular = useMemo(() => {
        if (kindRaw.includes("CHARGE")) return true
        if (CHARGE_PARTICULAR_CODES.has(codeUpper)) return true
        // if backend says module is MISC and your code is MIS-like
        if (particularModule === "MISC" && (codeUpper === "MIS" || codeUpper === "MISC")) return true
        return false
    }, [kindRaw, codeUpper, particularModule])

    // RAW mode from backend
    const uiMode = useMemo(() => {
        if (kindRaw.includes("BED")) return "BED"
        if (kindRaw.includes("DOCTOR")) return "DOCTOR"
        if (kindRaw.includes("MANUAL")) return "MANUAL"
        return "MASTER"
    }, [kindRaw])

    // ✅ Keep manual source, but we HARD-GATE Charge Master so it can't appear for unrelated particulars
    const [manualSource, setManualSource] = useState("FREE") // FREE | CHARGE

    // ✅ Effective mode
    const effectiveMode = useMemo(() => {
        // ✅ If this is a charge particular, ALWAYS show Charge Master UI (correct workflow)
        if (isChargeParticular) return "CHARGE_ITEM"

        // Optional: allow manual → charge switch only if backend explicitly indicates CHARGE
        if (uiMode === "MANUAL" && manualSource === "CHARGE" && kindRaw.includes("CHARGE")) return "CHARGE_ITEM"

        // backend explicit charge
        if (kindRaw.includes("CHARGE_ITEM") || kindRaw.includes("CHARGEITEM") || kindRaw.includes("CHARGE")) {
            return "CHARGE_ITEM"
        }

        return uiMode
    }, [uiMode, manualSource, kindRaw, isChargeParticular])

    // Defaults for NEW rows
    const [defServiceDate, setDefServiceDate] = useState("")
    const [defQty, setDefQty] = useState("1")
    const [defGstRate, setDefGstRate] = useState("")
    const [defDesc, setDefDesc] = useState("")
    const [defUnitPrice, setDefUnitPrice] = useState("")
    const [autoFillFromMaster, setAutoFillFromMaster] = useState(true)

    // MASTER filters
    const [searchText, setSearchText] = useState("")
    const [modality, setModality] = useState("")

    // ✅ CHARGE MASTER filters
    const [chargeCategory, setChargeCategory] = useState("MISC")
    const [chargeModuleHeader, setChargeModuleHeader] = useState("")
    const [chargeServiceHeader, setChargeServiceHeader] = useState("")
    const [chargeActiveOnly, setChargeActiveOnly] = useState(true)

    // BED filters
    const [wardId, setWardId] = useState("")
    const [roomId, setRoomId] = useState("")
    const [bedSearch, setBedSearch] = useState("")

    // DOCTOR filters
    const [deptId, setDeptId] = useState("")
    const [doctorId, setDoctorId] = useState("")

    // Cart rows
    const [cart, setCart] = useState([])

    const wards = opts?.options?.wards || opts?.wards || []
    const rooms = opts?.options?.rooms || opts?.rooms || []
    const beds = opts?.options?.beds || opts?.beds || []
    const departments = opts?.options?.departments || opts?.departments || []
    const doctors = opts?.options?.doctors || opts?.doctors || []

    const rawMasterItems = useMemo(() => {
        const arr = findAnyArrayDeep(opts) || []
        return Array.isArray(arr) ? arr : []
    }, [opts])

    // ✅ CHARGE items filtered locally (module/service headers are ONLY filters, NOT storage routing)
    const masterItems = useMemo(() => {
        if (effectiveMode !== "CHARGE_ITEM") return rawMasterItems

        const mh = String(chargeModuleHeader || "").trim().toUpperCase()
        const sh = String(chargeServiceHeader || "").trim().toUpperCase()
        const cat = String(chargeCategory || "").trim().toUpperCase()

        return rawMasterItems.filter((it) => {
            if (!it) return false
            const itMh = String(it?.module_header || it?.moduleHeader || "").trim().toUpperCase()
            const itSh = String(it?.service_header || it?.serviceHeader || "").trim().toUpperCase()
            const itCat = String(it?.category || "").trim().toUpperCase()

            if (cat && itCat && itCat !== cat) return false
            if (mh && itMh !== mh) return false
            if (sh && itSh !== sh) return false
            return true
        })
    }, [rawMasterItems, effectiveMode, chargeCategory, chargeModuleHeader, chargeServiceHeader])

    const moduleHeaderOptions = useMemo(() => {
        const arr = rawMasterItems.map((x) => x?.module_header || x?.moduleHeader).filter(Boolean)
        return uniqUpper(arr)
    }, [rawMasterItems])

    const serviceHeaderOptions = useMemo(() => {
        const arr = rawMasterItems.map((x) => x?.service_header || x?.serviceHeader).filter(Boolean)
        return uniqUpper(arr)
    }, [rawMasterItems])

    function resetAll() {
        setDefServiceDate("")
        setDefQty("1")
        setDefGstRate("")
        setDefDesc("")
        setDefUnitPrice("")
        setAutoFillFromMaster(true)

        setSearchText("")
        setModality("")

        setChargeModuleHeader("")
        setChargeServiceHeader("")
        setChargeActiveOnly(true)

        setWardId("")
        setRoomId("")
        setBedSearch("")

        setDeptId("")
        setDoctorId("")

        setCart([])
        setManualSource("FREE")
    }

    // ✅ Auto-set default Charge Category based on selected particular (correct UX)
    useEffect(() => {
        if (!isChargeParticular) return
        const next =
            codeUpper === "ADM"
                ? "ADM"
                : codeUpper === "DIET"
                    ? "DIET"
                    : codeUpper === "BLOOD"
                        ? "BLOOD"
                        : "MISC"
        setChargeCategory(next)
        setChargeModuleHeader("")
        setChargeServiceHeader("")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codeUpper, isChargeParticular])

    async function loadBase() {
        abortBaseRef.current?.abort?.()
        const ac = new AbortController()
        abortBaseRef.current = ac

        setLoading(true)
        try {
            const [c, meta] = await Promise.all([
                billingGetCase(caseId, { signal: ac.signal }),
                billingMetaParticulars({ signal: ac.signal }),
            ])
            setCaseRow(c)
            const items = meta?.items || []
            setParticulars(items)
            setCode(items?.[0]?.code || "ROOM")
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load")
        } finally {
            setLoading(false)
        }
    }

    async function loadOptions(nextCode = code) {
        if (!nextCode) return
        setOptLoading(true)

        try {
            // ✅ Charge Master always loads from /masters/charge-items
            if (effectiveMode === "CHARGE_ITEM") {
                const res = await listChargeItems({
                    category: chargeCategory || undefined,
                    is_active: chargeActiveOnly ? true : undefined,
                    search: searchText || "",
                    page: 1,
                    page_size: 200,
                    sort: "updated_at",
                    order: "desc",
                })
                setOpts({ items: res?.items || [] })
                return
            }

            const params = {
                service_date: defServiceDate || undefined,

                // BED
                ward_id: wardId || undefined,
                room_id: roomId || undefined,

                // search alias support
                search: effectiveMode === "BED" ? (bedSearch || "") : (searchText || ""),
                q: effectiveMode === "BED" ? (bedSearch || "") : (searchText || ""),

                // DOCTOR
                department_id: deptId || undefined,
                dept_id: deptId || undefined,

                // RAD
                modality: modality || undefined,

                limit: 200,
            }
            const res = await billingParticularOptions(caseId, nextCode, params)
            setOpts(res || null)
        } catch (e) {
            toast.error(e?.message || "Failed to load options")
            setOpts(null)
        } finally {
            setOptLoading(false)
        }
    }

    useEffect(() => {
        loadBase()
        return () => abortBaseRef.current?.abort?.()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    useEffect(() => {
        if (!loading) loadOptions(code)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, loading, effectiveMode])

    // reload when BED filters/service date change
    useEffect(() => {
        if (loading) return
        if (effectiveMode !== "BED") return
        loadOptions(code)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wardId, roomId, defServiceDate, effectiveMode])

    // reload when dept changes (doctor)
    useEffect(() => {
        if (loading) return
        if (effectiveMode !== "DOCTOR") return
        setDoctorId("")
        loadOptions(code)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deptId, effectiveMode])

    // debounce searches & charge filters
    useEffect(() => {
        if (loading) return
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => loadOptions(code), 350)
        return () => debounceRef.current && clearTimeout(debounceRef.current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        searchText,
        bedSearch,
        modality,
        chargeCategory,
        chargeActiveOnly,
        chargeModuleHeader,
        chargeServiceHeader,
        effectiveMode,
    ])

    function addCartRowFromMaster(it) {
        const key = mkRowKey()
        const label = getItemLabel(it)
        const basePrice = String(getItemPrice(it) || "")
        const baseGst = String(getItemGst(it) || "")

        const row = {
            key,
            item_id: Number(it.id),
            item_code: it?.code || null,
            label,
            base_price: basePrice,
            base_gst: baseGst,

            // ✅ ONLY for display/filter context (not used for invoice routing)
            module_header: String(it?.module_header || it?.moduleHeader || "").trim(),
            service_header: String(it?.service_header || it?.serviceHeader || "").trim(),
            category: String(it?.category || "").trim(),

            service_date: defServiceDate || "",
            qty: defQty || "1",
            gst_rate: (defGstRate !== "" ? defGstRate : autoFillFromMaster ? baseGst : "") || "0",
            unit_price:
                (defUnitPrice !== ""
                    ? defUnitPrice
                    : shouldAutofillPrice(basePrice, autoFillFromMaster)
                        ? basePrice
                        : "") || "",
            description: (defDesc || (autoFillFromMaster ? label : "")) || "",
            meta: it?.meta || null,
        }

        setCart((prev) => [...prev, row])
    }

    function addCartRowFromBed(b) {
        const key = mkRowKey()
        const label = b?.label || `Bed #${b?.id}`
        const basePrice = String(b?.suggested_rate ?? b?.suggestedRate ?? b?.rate ?? "")
        const baseGst = defGstRate !== "" ? defGstRate : String(b?.gst_rate ?? b?.gst ?? 0)

        const row = {
            key,
            item_id: Number(b.id),
            label,
            base_price: basePrice,
            base_gst: baseGst,
            service_date: defServiceDate || "",
            qty: defQty || "1",
            gst_rate: baseGst !== "" ? baseGst : "0",
            unit_price:
                defUnitPrice !== ""
                    ? defUnitPrice
                    : shouldAutofillPrice(basePrice, autoFillFromMaster)
                        ? basePrice
                        : "",
            description: (defDesc || (autoFillFromMaster ? label : "")) || "",
            ward_id: b?.meta?.ward_id ?? b?.meta?.wardId ?? null,
            room_id: b?.meta?.room_id ?? b?.meta?.roomId ?? null,
            meta: b?.meta || null,
        }

        setCart((prev) => [...prev, row])
    }

    function validateCart() {
        if (cart.length === 0) return "Add at least one item"
        for (const r of cart) {
            const q = num(r.qty, 0)
            if (!Number.isFinite(q) || q <= 0) return `Qty must be > 0 (${r.label})`
            const g = num(r.gst_rate, 0)
            if (g < 0 || g > 100) return `GST must be 0 to 100 (${r.label})`
            if (r.unit_price !== "") {
                const p = num(r.unit_price, -1)
                if (!Number.isFinite(p) || p < 0) return `Invalid price (${r.label})`
            }
        }
        return null
    }

    function cartPreviewTotals() {
        let sub = 0
        let tax = 0
        for (const r of cart) {
            const q = num(r.qty, 0)
            const p = r.unit_price === "" ? null : num(r.unit_price, 0)
            const g = num(r.gst_rate, 0)
            if (p == null) continue
            const line = q * p
            sub += line
            tax += (line * g) / 100
        }
        return { sub, tax, total: sub + tax }
    }

    // ✅ Correct invoice module selection for Charge Master:
    // MIS/MISC/ADM/DIET/BLOOD → always add into MISC invoice (module header is invoice.module, not charge item header)
    function getChargeInvoiceModule() {
        const m = (particularModule || codeUpper || "MISC").trim().toUpperCase()
        if (m === "MIS") return "MISC"
        if (m === "ADM" || m === "DIET" || m === "BLOOD") return "MISC"
        if (m === "MISC") return "MISC"
        return "MISC"
    }

    async function pickOrCreateInvoiceForModule(caseIdNum, targetModule) {
        const invRes = await billingListInvoices(caseIdNum)
        const invoices = invRes?.items || invRes?.invoices || (Array.isArray(invRes) ? invRes : [])

        const mod = String(targetModule || "").trim().toUpperCase() || "MISC"

        const isDraft = (x) => String(x?.status || "").toUpperCase() === "DRAFT"
        const invModule = (x) => String(x?.module || "").trim().toUpperCase()

        let inv = invoices.find((x) => isDraft(x) && invModule(x) === mod)

        if (!inv) {
            // fallback: draft invoice with empty module or MISC
            inv = invoices.find((x) => isDraft(x) && (!invModule(x) || invModule(x) === "MISC"))
        }

        if (inv?.id) return inv

        try {
            const created = await billingCreateInvoice(caseIdNum, { module: mod })
            return created
        } catch {
            throw new Error(`No draft invoice available for module ${mod}. Create invoice first.`)
        }
    }

    async function onSubmit() {
        try {
            const caseIdNum = Number(caseId)
            if (!Number.isFinite(caseIdNum) || caseIdNum <= 0) return toast.error("Invalid case")

            // ✅ CHARGE MASTER (corrected)
            if (effectiveMode === "CHARGE_ITEM") {
                // HARD GATE: only MIS/MISC/ADM/DIET/BLOOD (or kind CHARGE)
                if (!isChargeParticular && !kindRaw.includes("CHARGE")) {
                    return toast.error("Charge Master is allowed only for MIS/MISC/ADM/DIET/BLOOD particulars.")
                }

                const err = validateCart()
                if (err) return toast.error(err)

                const invoiceModule = getChargeInvoiceModule()
                const inv = await pickOrCreateInvoiceForModule(caseIdNum, invoiceModule)

                let totalAdded = 0
                for (const r of cart) {
                    await billingAddChargeItemLine(
                        inv.id,
                        {
                            charge_item_id: Number(r.item_id),
                            qty: num(r.qty, 1),
                            unit_price: r.unit_price === "" ? null : num(r.unit_price, 0),
                            gst_rate: r.gst_rate === "" ? null : num(r.gst_rate, 0),
                            discount_percent: 0,
                            discount_amount: 0,
                            manual_reason: `CHARGE_MASTER:${codeUpper || "MISC"}`,
                            idempotency_key: r.key,
                        },
                        {}
                    )
                    totalAdded += 1
                }

                toast.success(`Added ${totalAdded} charge item line(s) to ${invoiceModule} invoice`)
                return nav(`/billing/cases/${caseId}`)
            }

            // ---------------- BED (cart-based) ----------------
            if (effectiveMode === "BED") {
                const err = validateCart()
                if (err) return toast.error(err)

                const lines = cart.map((r) => ({
                    line_key: r.key,
                    item_id: Number(r.item_id),
                    service_date: r.service_date || null,
                    qty: num(r.qty, 1),
                    gst_rate: num(r.gst_rate, 0),
                    unit_price: r.unit_price === "" ? null : num(r.unit_price, 0),
                    description: (r.description || "").trim() || null,
                    ward_id: r.ward_id != null ? Number(r.ward_id) : wardId ? Number(wardId) : null,
                    room_id: r.room_id != null ? Number(r.room_id) : roomId ? Number(roomId) : null,
                }))

                const payload = { item_ids: lines.map((x) => x.item_id), lines }
                await billingParticularAdd(caseId, code, payload)
                toast.success(`Added ${lines.length} bed charge line(s)`)
                return nav(`/billing/cases/${caseId}`)
            }

            // ---------------- DOCTOR (single) ----------------
            if (effectiveMode === "DOCTOR") {
                if (!doctorId) return toast.error("Select doctor")
                const payload = {
                    doctor_id: Number(doctorId),
                    service_date: defServiceDate || null,
                    qty: num(defQty, 1),
                    gst_rate: defGstRate === "" ? 0 : num(defGstRate, 0),
                    unit_price: defUnitPrice === "" ? null : num(defUnitPrice, 0),
                    description: (defDesc || "").trim() || null,
                }
                await billingParticularAdd(caseId, code, payload)
                toast.success("Doctor fee added")
                return nav(`/billing/cases/${caseId}`)
            }

            // ---------------- MASTER (cart-based) ----------------
            if (effectiveMode === "MASTER") {
                const err = validateCart()
                if (err) return toast.error(err)

                const lines = cart.map((r) => ({
                    line_key: r.key,
                    item_id: Number(r.item_id),
                    service_date: r.service_date || null,
                    qty: num(r.qty, 1),
                    gst_rate: num(r.gst_rate, 0),
                    unit_price: r.unit_price === "" ? null : num(r.unit_price, 0),
                    description: (r.description || "").trim() || null,
                    modality: modality || null,
                }))

                const payload = { item_ids: lines.map((x) => x.item_id), modality: modality || null, lines }
                await billingParticularAdd(caseId, code, payload)
                toast.success(`Added ${lines.length} item(s)`)
                return nav(`/billing/cases/${caseId}`)
            }

            // ---------------- MANUAL (Free Text) ----------------
            const desc = (defDesc || "").trim()
            if (!desc) return toast.error("Enter description")
            const price = num(defUnitPrice, 0)
            if (price <= 0) return toast.error("Enter amount (>0)")

            const payload = {
                service_date: defServiceDate || null,
                qty: num(defQty, 1),
                gst_rate: defGstRate === "" ? 0 : num(defGstRate, 0),
                description: desc,
                unit_price: price,
            }

            await billingParticularAdd(caseId, code, payload)
            toast.success("Item added")
            return nav(`/billing/cases/${caseId}`)
        } catch (e) {
            toast.error(e?.message || "Failed to add item")
        }
    }

    const totals = useMemo(() => cartPreviewTotals(), [cart])

    if (loading) {
        return (
            <div className="p-4">
                <Card>
                    <CardHeader title="Add Item Line" />
                    <CardBody>Loading…</CardBody>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" onClick={() => nav(-1)} className="gap-2">
                    <ArrowLeft size={16} /> Back
                </Button>

                <Button variant="outline" onClick={() => loadOptions(code)} className="gap-2" disabled={optLoading}>
                    <RefreshCcw size={16} /> Refresh
                </Button>
            </div>

            <Card>
                <CardHeader
                    title="Add Item Line"
                    subtitle={`${caseRow?.case_number || ""} · ${caseRow?.encounter_type || ""}/${caseRow?.encounter_id || ""}`}
                />
                <CardBody className="space-y-4">
                    {/* PARTICULAR + DEFAULTS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Particular">
                            <Select
                                value={code}
                                onChange={(e) => {
                                    setCode(e.target.value)
                                    resetAll()
                                }}
                            >
                                {particulars.map((p) => (
                                    <option key={p.code} value={p.code}>
                                        {p.label}
                                    </option>
                                ))}
                            </Select>

                            <div className="mt-1 text-xs text-slate-500">
                                kind: <span className="font-mono">{kindRaw || "—"}</span> · mode:{" "}
                                <span className="font-mono">{effectiveMode}</span>
                                {effectiveMode === "CHARGE_ITEM" ? (
                                    <span className="ml-2 rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-800">
                                        Charge Master Workflow ✅
                                    </span>
                                ) : null}
                            </div>
                        </Field>

                        <Field label="Default Service Date (optional)">
                            <Input type="date" value={defServiceDate} onChange={(e) => setDefServiceDate(e.target.value)} />
                            <div className="mt-1 text-xs text-slate-500">
                                Each row can change its own date (this is only the default when adding).
                            </div>
                        </Field>

                        {/* NOTE: Manual source retained, but Charge Master is now gated by MIS/MISC workflow */}
                        {uiMode === "MANUAL" && !isChargeParticular && kindRaw.includes("CHARGE") ? (
                            <Field label="Manual Input Type">
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setManualSource("FREE")}
                                        className={cx(
                                            "h-10 px-3 rounded-xl border text-sm font-semibold transition",
                                            manualSource === "FREE"
                                                ? "border-slate-900 bg-slate-900 text-white"
                                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        Free Text
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setManualSource("CHARGE")
                                            setCart([])
                                            loadOptions(code)
                                        }}
                                        className={cx(
                                            "h-10 px-3 rounded-xl border text-sm font-semibold transition",
                                            manualSource === "CHARGE"
                                                ? "border-slate-900 bg-slate-900 text-white"
                                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        Charge Master
                                    </button>
                                </div>
                            </Field>
                        ) : null}

                        <Field label="Default Qty">
                            <Input value={defQty} onChange={(e) => setDefQty(e.target.value)} />
                        </Field>

                        <Field label="Default GST % (optional)">
                            <Input value={defGstRate} onChange={(e) => setDefGstRate(e.target.value)} placeholder="Leave empty to use master/default" />
                        </Field>

                        <Field label="Default Description (optional)">
                            <Input value={defDesc} onChange={(e) => setDefDesc(e.target.value)} placeholder="Leave empty to use master name" />
                        </Field>

                        <Field label="Default Unit Price (optional)">
                            <Input value={defUnitPrice} onChange={(e) => setDefUnitPrice(e.target.value)} placeholder="Leave empty to use master pricing" />
                            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 select-none">
                                <input type="checkbox" checked={autoFillFromMaster} onChange={(e) => setAutoFillFromMaster(e.target.checked)} />
                                Auto-fill from master while adding
                            </label>
                        </Field>
                    </div>

                    {/* ✅ CHARGE MASTER FILTERS + LIST (ONLY for MIS/MISC/ADM/DIET/BLOOD) */}
                    {effectiveMode === "CHARGE_ITEM" && (
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <div className="font-extrabold text-slate-900">Charge Master Workflow</div>
                                <div className="mt-1 text-xs text-slate-600">
                                    Module is decided by selected particular (MIS → MISC invoice). Module/Service headers below are only for filtering charge items.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <Field label="Charge Category">
                                    <Select value={chargeCategory} onChange={(e) => setChargeCategory(e.target.value)}>
                                        {CHARGE_CATEGORIES.map((c) => (
                                            <option key={c.value} value={c.value}>
                                                {c.value} — {c.label}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Search charge items">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <Input className="pl-9" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search by code / name" />
                                    </div>
                                </Field>

                                <Field label="Active Only">
                                    <Select value={chargeActiveOnly ? "YES" : "NO"} onChange={(e) => setChargeActiveOnly(e.target.value === "YES")}>
                                        <option value="YES">Yes</option>
                                        <option value="NO">No</option>
                                    </Select>
                                </Field>

                                <Field label=" ">
                                    <Button variant="outline" className="gap-2" onClick={() => loadOptions(code)} disabled={optLoading}>
                                        <RefreshCcw size={16} /> Reload
                                    </Button>
                                </Field>
                            </div>

                            {/* Show module/service headers only in MISC category (as requested) */}
                            {String(chargeCategory).toUpperCase() === "MISC" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Field label="Module Header (MISC)">
                                        <Select value={chargeModuleHeader} onChange={(e) => setChargeModuleHeader(e.target.value)}>
                                            <option value="">All</option>
                                            {moduleHeaderOptions.map((m) => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </Select>
                                    </Field>

                                    <Field label="Service Header (MISC)">
                                        <Select value={chargeServiceHeader} onChange={(e) => setChargeServiceHeader(e.target.value)}>
                                            <option value="">All</option>
                                            {serviceHeaderOptions.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </Select>
                                    </Field>
                                </div>
                            )}

                            <div className="border rounded-xl overflow-hidden">
                                <div className="max-h-[360px] overflow-auto">
                                    {masterItems.length === 0 ? (
                                        <div className="p-3 text-sm text-slate-500">No charge items found.</div>
                                    ) : (
                                        <div className="divide-y">
                                            {masterItems.map((it) => {
                                                const id = Number(it.id)
                                                const label = getItemLabel(it)
                                                const price = getItemPrice(it)
                                                const gst = getItemGst(it)
                                                const mh = String(it?.module_header || "").toUpperCase()
                                                const sh = String(it?.service_header || "").toUpperCase()

                                                return (
                                                    <div key={id} className="p-3 flex items-start justify-between gap-3 bg-white">
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900">{label}</div>
                                                            <div className="text-xs text-slate-500">
                                                                {mh ? `Module: ${mh}` : ""}{mh && sh ? " · " : ""}{sh ? `Service: ${sh}` : ""}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right min-w-[150px]">
                                                                <div className="text-sm font-semibold text-slate-900">₹{price.toFixed(2)}</div>
                                                                <div className="text-xs text-slate-500">GST {gst}%</div>
                                                            </div>
                                                            <Button variant="outline" className="gap-2" onClick={() => addCartRowFromMaster(it)}>
                                                                <PlusCircle size={16} /> Add
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DOCTOR */}
                    {effectiveMode === "DOCTOR" && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Field label="Department (optional)">
                                    <Select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                                        <option value="">All</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>{d.label}</option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Doctor">
                                    <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                                        <option value="">Select</option>
                                        {doctors.map((d) => (
                                            <option key={d.id} value={d.id}>{d.label}</option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>
                        </div>
                    )}

                    {/* BED */}
                    {effectiveMode === "BED" && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Field label="Ward">
                                    <Select value={wardId} onChange={(e) => setWardId(e.target.value)}>
                                        <option value="">All</option>
                                        {wards.map((w) => (
                                            <option key={w.id} value={w.id}>{w.label}</option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Room">
                                    <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                                        <option value="">All</option>
                                        {rooms.map((r) => (
                                            <option key={r.id} value={r.id}>{r.label}</option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Search Bed">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <Input className="pl-9" value={bedSearch} onChange={(e) => setBedSearch(e.target.value)} placeholder="Bed code / room / ward" />
                                    </div>
                                </Field>
                            </div>

                            <div className="border rounded-xl overflow-hidden">
                                <div className="max-h-[360px] overflow-auto">
                                    {beds.length === 0 ? (
                                        <div className="p-3 text-sm text-slate-500">No beds found.</div>
                                    ) : (
                                        <div className="divide-y">
                                            {beds.map((b) => {
                                                const price = String(b?.suggested_rate ?? "")
                                                return (
                                                    <div key={b.id} className="p-3 flex items-start justify-between gap-3 bg-white">
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900">{b.label}</div>
                                                            <div className="text-xs text-slate-500">Suggested: ₹{price || "0"}</div>
                                                        </div>
                                                        <Button variant="outline" className="gap-2" onClick={() => addCartRowFromBed(b)}>
                                                            <PlusCircle size={16} /> Add
                                                        </Button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MASTER */}
                    {effectiveMode === "MASTER" && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Field label="Search master">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <Input className="pl-9" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search by code / name" />
                                    </div>
                                </Field>

                                <Field label="Modality (Radiology optional)">
                                    <Input value={modality} onChange={(e) => setModality(e.target.value)} placeholder="XRAY / CT / MRI / US…" />
                                </Field>

                                <Field label=" ">
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="gap-2" onClick={() => setCart([])} disabled={!cart.length} title="Clear cart">
                                            <Trash2 size={16} /> Clear Cart
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="gap-2"
                                            onClick={() => {
                                                setCart((prev) =>
                                                    prev.map((r) => ({
                                                        ...r,
                                                        service_date: defServiceDate !== "" ? defServiceDate : r.service_date,
                                                        qty: defQty !== "" ? defQty : r.qty,
                                                        gst_rate: defGstRate !== "" ? defGstRate : r.gst_rate,
                                                        unit_price: defUnitPrice !== "" ? defUnitPrice : r.unit_price,
                                                        description: defDesc !== "" ? defDesc : r.description,
                                                    }))
                                                )
                                                toast.success("Defaults applied to all rows")
                                            }}
                                            disabled={!cart.length}
                                            title="Apply defaults to all cart rows"
                                        >
                                            <RotateCcw size={16} /> Apply Defaults
                                        </Button>
                                    </div>
                                </Field>
                            </div>

                            <div className="border rounded-xl overflow-hidden">
                                <div className="max-h-[360px] overflow-auto">
                                    {masterItems.length === 0 ? (
                                        <div className="p-3 text-sm text-slate-500">No master items returned.</div>
                                    ) : (
                                        <div className="divide-y">
                                            {masterItems.map((it) => {
                                                const id = Number(it.id)
                                                const label = getItemLabel(it)
                                                const price = getItemPrice(it)
                                                const gst = getItemGst(it)

                                                return (
                                                    <div key={id} className="p-3 flex items-start justify-between gap-3 bg-white">
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900">{label}</div>
                                                            <div className="text-xs text-slate-500">
                                                                {it?.code ? `Code: ${it.code}` : ""} {it?.modality ? `· ${it.modality}` : ""}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right min-w-[150px]">
                                                                <div className="text-sm font-semibold text-slate-900">₹{price.toFixed(2)}</div>
                                                                <div className="text-xs text-slate-500">GST {gst}%</div>
                                                            </div>
                                                            <Button variant="outline" className="gap-2" onClick={() => addCartRowFromMaster(it)}>
                                                                <PlusCircle size={16} /> Add
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CART (for BED + MASTER + CHARGE_ITEM) */}
                    {(effectiveMode === "MASTER" || effectiveMode === "BED" || effectiveMode === "CHARGE_ITEM") && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-900">Selected Items ({cart.length})</div>
                                <div className="text-xs text-slate-500">Each row has its own Qty / Date / GST / Price ✅</div>
                            </div>

                            <div className="border rounded-xl overflow-x-auto">
                                {cart.length === 0 ? (
                                    <div className="p-3 text-sm text-slate-500">No items added yet.</div>
                                ) : (
                                    <table className="min-w-[980px] w-full text-sm">
                                        <thead className="bg-slate-50 border-b">
                                            <tr className="text-left">
                                                <th className="p-2">Item</th>
                                                <th className="p-2 w-[160px]">Service Date</th>
                                                <th className="p-2 w-[90px]">Qty</th>
                                                <th className="p-2 w-[110px]">GST %</th>
                                                <th className="p-2 w-[140px]">Unit Price</th>
                                                <th className="p-2 w-[220px]">Description</th>
                                                <th className="p-2 w-[140px] text-right">Preview Total</th>
                                                <th className="p-2 w-[60px]"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {cart.map((r) => {
                                                const q = num(r.qty, 0)
                                                const p = r.unit_price === "" ? null : num(r.unit_price, 0)
                                                const g = num(r.gst_rate, 0)
                                                const line = p == null ? null : q * p
                                                const total = line == null ? null : line + (line * g) / 100

                                                const mh = String(r.module_header || "").trim()
                                                const sh = String(r.service_header || "").trim()

                                                return (
                                                    <tr key={r.key} className="bg-white">
                                                        <td className="p-2">
                                                            <div className="font-medium text-slate-900">{r.label}</div>
                                                            <div className="text-xs text-slate-500">
                                                                Suggest: ₹{r.base_price || "—"} · GST {r.base_gst || "—"}%
                                                                {mh || sh ? ` · ${mh ? `Module ${mh}` : ""}${mh && sh ? " · " : ""}${sh ? `Service ${sh}` : ""}` : ""}
                                                            </div>
                                                        </td>

                                                        <td className="p-2">
                                                            <Input
                                                                type="date"
                                                                value={r.service_date || ""}
                                                                onChange={(e) =>
                                                                    setCart((prev) => prev.map((x) => (x.key === r.key ? { ...x, service_date: e.target.value } : x)))
                                                                }
                                                            />
                                                        </td>

                                                        <td className="p-2">
                                                            <Input
                                                                value={r.qty}
                                                                onChange={(e) =>
                                                                    setCart((prev) => prev.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))
                                                                }
                                                            />
                                                        </td>

                                                        <td className="p-2">
                                                            <Input
                                                                value={r.gst_rate}
                                                                onChange={(e) =>
                                                                    setCart((prev) => prev.map((x) => (x.key === r.key ? { ...x, gst_rate: e.target.value } : x)))
                                                                }
                                                            />
                                                        </td>

                                                        <td className="p-2">
                                                            <Input
                                                                value={r.unit_price}
                                                                onChange={(e) =>
                                                                    setCart((prev) => prev.map((x) => (x.key === r.key ? { ...x, unit_price: e.target.value } : x)))
                                                                }
                                                                placeholder="Blank = master/backend"
                                                            />
                                                        </td>

                                                        <td className="p-2">
                                                            <Input
                                                                value={r.description}
                                                                onChange={(e) =>
                                                                    setCart((prev) => prev.map((x) => (x.key === r.key ? { ...x, description: e.target.value } : x)))
                                                                }
                                                                placeholder="Optional"
                                                            />
                                                        </td>

                                                        <td className="p-2 text-right font-semibold">
                                                            {total == null ? <span className="text-slate-400">—</span> : `₹${total.toFixed(2)}`}
                                                        </td>

                                                        <td className="p-2">
                                                            <Button variant="ghost" onClick={() => setCart((prev) => prev.filter((x) => x.key !== r.key))} title="Remove row">
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <div className="text-slate-600">
                                    Preview (only rows with price filled):{" "}
                                    <span className="font-semibold">Sub ₹{totals.sub.toFixed(2)}</span> · Tax ₹{totals.tax.toFixed(2)} ·{" "}
                                    <span className="font-semibold">Total ₹{totals.total.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-slate-500">Final amounts are computed by backend invoice engine.</div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => nav(-1)}>
                            Cancel
                        </Button>
                        <Button onClick={onSubmit} className="gap-2" disabled={optLoading}>
                            <PlusCircle size={16} /> Add Item
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </div>
    )
}
