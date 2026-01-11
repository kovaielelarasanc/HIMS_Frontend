// FILE: src/billing/BillingAddItem.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import API from "@/api/client"

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

import { Button, Card, CardBody, CardHeader, Field, Input, Select } from "./_ui"
import { ArrowLeft, PlusCircle, RefreshCcw, Search, Trash2 } from "lucide-react"

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

function mkRowKey() {
    try {
        if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
    } catch { }
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function cleanParams(obj) {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) {
        if (v === undefined || v === null) continue
        if (typeof v === "string" && v.trim() === "") continue
        out[k] = v
    }
    return out
}

function isLikelyItemObj(x) {
    if (!x || typeof x !== "object") return false
    return x.id != null && (x.name != null || x.label != null || x.code != null || x.title != null)
}

function findAnyArrayDeep(obj, depth = 3) {
    if (!obj || typeof obj !== "object" || depth < 0) return null
    if (Array.isArray(obj) && obj.some(isLikelyItemObj)) return obj

    const keys = ["items", "results", "rows", "services", "charge_items", "list"]
    for (const k of keys) {
        const arr = obj?.[k]
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
        it?.rate ??
        it?.amount ??
        it?.base_fee ??
        0
    return num(v, 0)
}

function getItemGst(it) {
    const v = it?.gst_rate ?? it?.gst ?? it?.tax_rate ?? 0
    return num(v, 0)
}

function normalizeHdr(v) {
    const s = String(v ?? "").trim().toUpperCase()
    return s === "" ? "" : s
}

function unwrapData(res) {
    // supports both: {status,data} and plain {items}
    const p = res?.data
    if (p && typeof p === "object" && "status" in p) {
        if (p?.status === false) {
            const msg = p?.error?.msg || p?.error?.message || "Request failed"
            throw new Error(msg)
        }
        return p?.data ?? {}
    }
    return p ?? {}
}

// -------- Doctor helpers --------
function getDoctorLabel(d) {
    return d?.label || d?.name || d?.full_name || d?.fullName || (d?.code ? `${d.code} - ${d?.name || ""}`.trim() : "") || `Doctor #${d?.id}`
}

function getDoctorDefaultFee(d) {
    // support common backend keys
    const v =
        d?.fee ??
        d?.doctor_fee ??
        d?.doctorFee ??
        d?.consultation_fee ??
        d?.consultationFee ??
        d?.base_fee ??
        d?.baseFee ??
        d?.price ??
        d?.rate ??
        d?.amount ??
        d?.suggested_rate ??
        d?.suggestedRate ??
        0
    return num(v, 0)
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

    // Optional: backend module hint on particular
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

    const isChargeParticular = useMemo(() => {
        if (kindRaw.includes("CHARGE")) return true
        if (CHARGE_PARTICULAR_CODES.has(codeUpper)) return true
        if (particularModule === "MISC" && (codeUpper === "MIS" || codeUpper === "MISC")) return true
        return false
    }, [kindRaw, codeUpper, particularModule])

    const uiMode = useMemo(() => {
        if (kindRaw.includes("BED")) return "BED"
        if (kindRaw.includes("DOCTOR")) return "DOCTOR"
        if (kindRaw.includes("MANUAL")) return "MANUAL"
        return "MASTER"
    }, [kindRaw])

    const effectiveMode = useMemo(() => {
        if (isChargeParticular) return "CHARGE_ITEM"
        if (kindRaw.includes("CHARGE_ITEM") || kindRaw.includes("CHARGEITEM") || kindRaw.includes("CHARGE")) {
            return "CHARGE_ITEM"
        }
        return uiMode
    }, [uiMode, kindRaw, isChargeParticular])

    // Filters
    const [searchText, setSearchText] = useState("")
    const [modality, setModality] = useState("")

    // Charge filters
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

    // ✅ DOCTOR fee inputs (NEW)
    const [doctorQty, setDoctorQty] = useState("1")
    const [doctorFee, setDoctorFee] = useState("") // string for input
    const [doctorServiceDate, setDoctorServiceDate] = useState("")
    const [doctorDesc, setDoctorDesc] = useState("Consultation Fee")
    const [doctorFeeOverridden, setDoctorFeeOverridden] = useState(false)

    // Cart
    const [cart, setCart] = useState([])

    const wards = opts?.options?.wards || opts?.wards || []
    const rooms = opts?.options?.rooms || opts?.rooms || []
    const beds = opts?.options?.beds || opts?.beds || []
    const departments = opts?.options?.departments || opts?.departments || []
    const doctors = opts?.options?.doctors || opts?.doctors || []

    const selectedDoctor = useMemo(() => {
        const did = Number(doctorId)
        if (!Number.isFinite(did) || did <= 0) return null
        return doctors.find((d) => Number(d.id) === did) || null
    }, [doctorId, doctors])

    // Auto-apply fee from doctor option (unless user overridden)
    useEffect(() => {
        if (effectiveMode !== "DOCTOR") return
        if (!selectedDoctor) return
        if (doctorFeeOverridden) return
        const f = getDoctorDefaultFee(selectedDoctor)
        setDoctorFee(f ? String(f) : "")
    }, [effectiveMode, selectedDoctor, doctorFeeOverridden])

    const rawItems = useMemo(() => {
        const arr = findAnyArrayDeep(opts) || []
        return Array.isArray(arr) ? arr : []
    }, [opts])

    // Derive headers from items (fallback if you don't have separate header endpoints)
    const moduleHeaderOptions = useMemo(() => {
        const set = new Set()
        for (const x of rawItems) {
            const mh = normalizeHdr(x?.module_header || x?.moduleHeader || "")
            if (mh) set.add(mh)
        }
        return Array.from(set).sort()
    }, [rawItems])

    const serviceHeaderOptions = useMemo(() => {
        const set = new Set()
        for (const x of rawItems) {
            const sh = normalizeHdr(x?.service_header || x?.serviceHeader || "")
            if (sh) set.add(sh)
        }
        return Array.from(set).sort()
    }, [rawItems])

    // Charge items filtered locally (safe even if backend doesn't support header filters)
    const filteredChargeItems = useMemo(() => {
        if (effectiveMode !== "CHARGE_ITEM") return rawItems

        const cat = normalizeHdr(chargeCategory)
        const mh = normalizeHdr(chargeModuleHeader)
        const sh = normalizeHdr(chargeServiceHeader)
        const q = String(searchText || "").trim().toLowerCase()

        return rawItems.filter((it) => {
            const itCat = normalizeHdr(it?.category || "")
            const itMh = normalizeHdr(it?.module_header || it?.moduleHeader || "")
            const itSh = normalizeHdr(it?.service_header || it?.serviceHeader || "")
            const label = getItemLabel(it).toLowerCase()
            const code = String(it?.code || "").toLowerCase()

            if (cat && itCat && itCat !== cat) return false
            if (cat === "MISC" && mh && itMh !== mh) return false
            if (cat === "MISC" && sh && itSh !== sh) return false
            if (q && !(label.includes(q) || code.includes(q))) return false
            return true
        })
    }, [rawItems, effectiveMode, chargeCategory, chargeModuleHeader, chargeServiceHeader, searchText])

    function resetFiltersOnParticularChange() {
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

        // ✅ reset doctor form
        setDoctorQty("1")
        setDoctorFee("")
        setDoctorServiceDate("")
        setDoctorDesc("Consultation Fee")
        setDoctorFeeOverridden(false)
    }

    // Auto-set charge category based on selected particular
    useEffect(() => {
        if (!isChargeParticular) return
        const next =
            codeUpper === "ADM" ? "ADM" : codeUpper === "DIET" ? "DIET" : codeUpper === "BLOOD" ? "BLOOD" : "MISC"
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

    // ✅ FIX 422: do NOT send empty strings, do NOT send sort/order, retry with alternate param names
    const fetchChargeItems = useCallback(async () => {
        const cat = normalizeHdr(chargeCategory) || undefined
        const mh = normalizeHdr(chargeCategory) === "MISC" ? normalizeHdr(chargeModuleHeader) || undefined : undefined
        const sh = normalizeHdr(chargeCategory) === "MISC" ? normalizeHdr(chargeServiceHeader) || undefined : undefined

        // attempt 1: common style (category, is_active, q/search, page, page_size)
        const p1 = cleanParams({
            category: cat,
            is_active: chargeActiveOnly ? true : undefined,
            q: searchText || undefined,
            search: searchText || undefined, // harmless if backend ignores; removed when empty
            page: 1,
            page_size: 200,
            module_header: mh,
            service_header: sh,
        })

        try {
            const res = await API.get("/masters/charge-items", { params: p1 })
            return unwrapData(res)
        } catch (e) {
            if (e?.response?.status !== 422) throw e

            // attempt 2: alt style (limit + active + q)
            const p2 = cleanParams({
                category: cat,
                active: chargeActiveOnly ? true : undefined,
                is_active: chargeActiveOnly ? 1 : undefined,
                q: searchText || undefined,
                limit: 300,
                module_header: mh,
                service_header: sh,
            })
            const res2 = await API.get("/masters/charge-items", { params: p2 })
            return unwrapData(res2)
        }
    }, [chargeActiveOnly, chargeCategory, chargeModuleHeader, chargeServiceHeader, searchText])

    async function loadOptions(nextCode = code) {
        if (!nextCode) return
        setOptLoading(true)

        try {
            if (effectiveMode === "CHARGE_ITEM") {
                const data = await fetchChargeItems()
                const items = data?.items || data?.results || data?.rows || data?.charge_items || []
                setOpts({ items })
                return
            }

            const params = cleanParams({
                // BED
                ward_id: effectiveMode === "BED" ? wardId || undefined : undefined,
                room_id: effectiveMode === "BED" ? roomId || undefined : undefined,
                q: effectiveMode === "BED" ? bedSearch || undefined : searchText || undefined,
                search: effectiveMode === "BED" ? bedSearch || undefined : searchText || undefined,

                // DOCTOR
                department_id: effectiveMode === "DOCTOR" ? deptId || undefined : undefined,

                // RAD optional
                modality: modality || undefined,

                limit: 200,
            })

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

    // reload when BED filters change
    useEffect(() => {
        if (loading) return
        if (effectiveMode !== "BED") return
        loadOptions(code)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wardId, roomId, bedSearch, effectiveMode])

    // reload when dept changes (doctor)
    useEffect(() => {
        if (loading) return
        if (effectiveMode !== "DOCTOR") return
        setDoctorId("")
        setDoctorFee("")
        setDoctorFeeOverridden(false)
        loadOptions(code)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deptId, effectiveMode])

    // debounce searches & charge filters
    useEffect(() => {
        if (loading) return
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => loadOptions(code), 300)
        return () => debounceRef.current && clearTimeout(debounceRef.current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchText, modality, chargeCategory, chargeActiveOnly, chargeModuleHeader, chargeServiceHeader, effectiveMode])

    function addCartRowFromMaster(it) {
        const key = mkRowKey()
        const label = getItemLabel(it)
        const basePrice = getItemPrice(it)
        const baseGst = getItemGst(it)

        const row = {
            key,
            item_id: Number(it.id),
            item_code: it?.code || null,
            label,

            // charge routing fields (if exists)
            category: normalizeHdr(it?.category || ""),
            module_header: normalizeHdr(it?.module_header || it?.moduleHeader || ""),
            service_header: normalizeHdr(it?.service_header || it?.serviceHeader || ""),

            service_date: "",
            qty: "1",
            gst_rate: String(baseGst ?? 0),
            unit_price: String(basePrice ?? 0),
            description: label,
        }

        setCart((prev) => [...prev, row])
    }

    function addCartRowFromBed(b) {
        const key = mkRowKey()
        const label = b?.label || `Bed #${b?.id}`
        const basePrice = num(b?.suggested_rate ?? b?.suggestedRate ?? b?.rate ?? 0, 0)

        const row = {
            key,
            item_id: Number(b.id),
            label,
            service_date: "",
            qty: "1",
            gst_rate: "0",
            unit_price: String(basePrice),
            description: label,
            ward_id: b?.meta?.ward_id ?? b?.meta?.wardId ?? null,
            room_id: b?.meta?.room_id ?? b?.meta?.roomId ?? null,
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
            const p = num(r.unit_price, -1)
            if (!Number.isFinite(p) || p < 0) return `Invalid price (${r.label})`
        }
        return null
    }

    function cartPreviewTotals() {
        let sub = 0
        let tax = 0
        for (const r of cart) {
            const q = num(r.qty, 0)
            const p = num(r.unit_price, 0)
            const g = num(r.gst_rate, 0)
            const line = q * p
            sub += line
            tax += (line * g) / 100
        }
        return { sub, tax, total: sub + tax }
    }

    function fallbackChargeModule() {
        const m = (particularModule || "").trim().toUpperCase()
        if (m) return m
        return "MISC"
    }

    async function pickOrCreateInvoiceForModule(caseIdNum, targetModule) {
        const invRes = await billingListInvoices(caseIdNum)
        const invoices = invRes?.items || invRes?.invoices || invRes?.data?.items || (Array.isArray(invRes) ? invRes : [])

        const mod = String(targetModule || "").trim().toUpperCase() || "MISC"
        const isDraft = (x) => String(x?.status || "").toUpperCase() === "DRAFT"
        const invModule = (x) => String(x?.module || "").trim().toUpperCase()

        let inv = invoices.find((x) => isDraft(x) && invModule(x) === mod)
        if (!inv) inv = invoices.find((x) => isDraft(x) && (!invModule(x) || invModule(x) === "MISC"))
        if (inv?.id) return inv

        const created = await billingCreateInvoice(caseIdNum, { module: mod })
        const createdInv = created?.id
            ? created
            : created?.invoice?.id
                ? created.invoice
                : created?.data?.id
                    ? created.data
                    : created
        if (!createdInv?.id) throw new Error(`Failed to create draft invoice for module ${mod}`)
        return createdInv
    }

    async function onSubmit() {
        try {
            const caseIdNum = Number(caseId)
            if (!Number.isFinite(caseIdNum) || caseIdNum <= 0) return toast.error("Invalid case")

            // CHARGE MASTER
            if (effectiveMode === "CHARGE_ITEM") {
                if (!isChargeParticular && !kindRaw.includes("CHARGE")) {
                    return toast.error("Charge Master is allowed only for MIS/MISC/ADM/DIET/BLOOD particulars.")
                }

                const err = validateCart()
                if (err) return toast.error(err)

                // group by invoice module (module_header wins; fallback MISC)
                const groups = new Map()
                for (const r of cart) {
                    const mod = normalizeHdr(r.module_header) || fallbackChargeModule()
                    const arr = groups.get(mod) || []
                    arr.push(r)
                    groups.set(mod, arr)
                }

                const results = []
                for (const [mod, rows] of groups.entries()) {
                    const inv = await pickOrCreateInvoiceForModule(caseIdNum, mod)

                    let added = 0
                    for (const r of rows) {
                        await billingAddChargeItemLine(inv.id, {
                            charge_item_id: Number(r.item_id),
                            qty: num(r.qty, 1),
                            unit_price: num(r.unit_price, 0),
                            gst_rate: num(r.gst_rate, 0),
                            discount_percent: 0,
                            discount_amount: 0,
                            manual_reason: `CHARGE_MASTER:${codeUpper || "MISC"}`,
                            idempotency_key: r.key,
                        })
                        added += 1
                    }
                    results.push({ module: mod, count: added })
                }

                toast.success(`Added: ${results.map((x) => `${x.module} (${x.count})`).join(" · ")}`)
                return nav(`/billing/cases/${caseId}`)
            }

            // BED / MASTER (cart)
            if (effectiveMode === "BED" || effectiveMode === "MASTER") {
                const err = validateCart()
                if (err) return toast.error(err)

                const lines = cart.map((r) => ({
                    line_key: r.key,
                    item_id: Number(r.item_id),
                    service_date: r.service_date || null,
                    qty: num(r.qty, 1),
                    gst_rate: num(r.gst_rate, 0),
                    unit_price: num(r.unit_price, 0),
                    description: (r.description || "").trim() || null,
                    modality: effectiveMode === "MASTER" ? modality || null : null,
                    ward_id:
                        effectiveMode === "BED"
                            ? r.ward_id != null
                                ? Number(r.ward_id)
                                : wardId
                                    ? Number(wardId)
                                    : null
                            : null,
                    room_id:
                        effectiveMode === "BED"
                            ? r.room_id != null
                                ? Number(r.room_id)
                                : roomId
                                    ? Number(roomId)
                                    : null
                            : null,
                }))

                const payload = { item_ids: lines.map((x) => x.item_id), modality: modality || null, lines }
                await billingParticularAdd(caseId, code, payload)
                toast.success(`Added ${lines.length} item(s)`)
                return nav(`/billing/cases/${caseId}`)
            }

            // ✅ DOCTOR (single form) — FIXED
            if (effectiveMode === "DOCTOR") {
                const did = Number(doctorId)
                if (!Number.isFinite(did) || did <= 0) return toast.error("Select doctor")

                const q = num(doctorQty, 1)
                if (!Number.isFinite(q) || q <= 0) return toast.error("Qty must be > 0")

                const fee = num(doctorFee, 0)
                if (!Number.isFinite(fee) || fee <= 0) return toast.error("Doctor fee missing (enter unit price)")

                const payload = {
                    // safest format for your backend check
                    lines: [
                        {
                            line_key: mkRowKey(),
                            doctor_id: did,
                            qty: q,
                            unit_price: fee,
                            service_date: doctorServiceDate || null,
                            description: (doctorDesc || "").trim() || "Consultation Fee",
                        },
                    ],
                }

                await billingParticularAdd(caseId, code, payload)
                toast.success("Doctor fee added")
                return nav(`/billing/cases/${caseId}`)
            }

            // MANUAL
            toast.error("Manual mode not enabled in this screen. Please use a manual line screen.")
        } catch (e) {
            toast.error(e?.message || "Failed to add item")
        }
    }

    const totals = useMemo(() => cartPreviewTotals(), [cart])

    const doctorPreviewTotal = useMemo(() => {
        const q = num(doctorQty, 1)
        const p = num(doctorFee, 0)
        const sub = q * p
        return { sub, tax: 0, total: sub }
    }, [doctorQty, doctorFee])

    const canSubmit = useMemo(() => {
        if (optLoading) return false
        if (effectiveMode === "DOCTOR") {
            const did = Number(doctorId)
            const fee = num(doctorFee, 0)
            const q = num(doctorQty, 1)
            return Number.isFinite(did) && did > 0 && Number.isFinite(fee) && fee > 0 && Number.isFinite(q) && q > 0
        }
        // other modes rely on cart
        return cart.length > 0
    }, [optLoading, effectiveMode, doctorId, doctorFee, doctorQty, cart.length])

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
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" onClick={() => nav(-1)} className="gap-2">
                    <ArrowLeft size={16} /> Back
                </Button>

                <Button variant="outline" onClick={() => loadOptions(code)} className="gap-2" disabled={optLoading}>
                    <RefreshCcw size={16} /> Refresh
                </Button>
            </div>

            {/* Title */}
            <Card>
                <CardHeader
                    title="Add Item Line"
                    subtitle={`${caseRow?.case_number || ""} · ${caseRow?.encounter_type || ""}/${caseRow?.encounter_id || ""}`}
                />
                <CardBody className="space-y-4">
                    {/* Particular */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Particular">
                            <Select
                                value={code}
                                onChange={(e) => {
                                    setCode(e.target.value)
                                    resetFiltersOnParticularChange()
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
                                    <span className="ml-2 rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-800">Charge Master ✅</span>
                                ) : null}
                                {effectiveMode === "DOCTOR" ? (
                                    <span className="ml-2 rounded-lg bg-blue-50 px-2 py-0.5 text-blue-800">Doctor Fee ✅</span>
                                ) : null}
                            </div>
                        </Field>

                        {/* Search only for non-doctor */}
                        <Field label="Global Search">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input
                                    className="pl-9"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder={effectiveMode === "DOCTOR" ? "Search disabled for Doctor Fee" : "Search by code / name"}
                                    disabled={effectiveMode === "DOCTOR"}
                                />
                            </div>
                        </Field>
                    </div>

                    {/* ✅ DOCTOR: Dedicated premium form (no cart/list) */}
                    {effectiveMode === "DOCTOR" ? (
                        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                            {/* Left: inputs */}
                            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                                <div className="px-4 py-3 border-b bg-slate-50">
                                    <div className="text-sm font-extrabold text-slate-900">Doctor Fee</div>
                                    <div className="text-xs text-slate-500">Select doctor, confirm fee, then add to billing case.</div>
                                </div>

                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Field label="Department (optional)">
                                        <Select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                                            <option value="">All</option>
                                            {departments.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.label}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>

                                    <Field label="Doctor">
                                        <Select
                                            value={doctorId}
                                            onChange={(e) => {
                                                setDoctorId(e.target.value)
                                                setDoctorFeeOverridden(false)
                                            }}
                                        >
                                            <option value="">Select</option>
                                            {doctors.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {getDoctorLabel(d)}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>

                                    <Field label="Unit Price (₹)">
                                        <Input
                                            value={doctorFee}
                                            onChange={(e) => {
                                                setDoctorFee(e.target.value)
                                                setDoctorFeeOverridden(true)
                                            }}
                                            placeholder="e.g., 500"
                                            inputMode="decimal"
                                        />
                                        {selectedDoctor ? (
                                            <div className="mt-1 text-xs text-slate-500">
                                                Suggested: ₹{getDoctorDefaultFee(selectedDoctor).toFixed(2)}
                                                {!doctorFeeOverridden ? (
                                                    <span className="ml-2 rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-800">Auto</span>
                                                ) : (
                                                    <span className="ml-2 rounded-lg bg-amber-50 px-2 py-0.5 text-amber-800">Override</span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-1 text-xs text-slate-400">Select doctor to auto-fill fee.</div>
                                        )}
                                    </Field>

                                    <Field label="Qty">
                                        <Input value={doctorQty} onChange={(e) => setDoctorQty(e.target.value)} placeholder="1" inputMode="decimal" />
                                    </Field>

                                    <Field label="Service Date (optional)">
                                        <Input type="date" value={doctorServiceDate} onChange={(e) => setDoctorServiceDate(e.target.value)} />
                                    </Field>

                                    <Field label="Description">
                                        <Input value={doctorDesc} onChange={(e) => setDoctorDesc(e.target.value)} placeholder="Consultation Fee" />
                                    </Field>
                                </div>
                            </div>

                            {/* Right: preview + action */}
                            <div className="space-y-3">
                                <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                                    <div className="px-4 py-3 border-b bg-slate-50">
                                        <div className="text-sm font-extrabold text-slate-900">Preview</div>
                                        <div className="text-xs text-slate-500">Totals preview (final computed by backend).</div>
                                    </div>

                                    <div className="p-4 space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600">Doctor</span>
                                            <span className="font-semibold text-slate-900">{selectedDoctor ? getDoctorLabel(selectedDoctor) : "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600">Qty</span>
                                            <span className="font-semibold text-slate-900">{num(doctorQty, 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600">Unit Price</span>
                                            <span className="font-semibold text-slate-900">₹{num(doctorFee, 0).toFixed(2)}</span>
                                        </div>
                                        <div className="h-px bg-slate-100 my-2" />
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600">Total</span>
                                            <span className="text-base font-extrabold text-slate-900">₹{doctorPreviewTotal.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => nav(-1)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={onSubmit} className="gap-2" disabled={!canSubmit}>
                                        <PlusCircle size={16} /> Add Doctor Fee
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // ✅ Existing Premium 2-column layout for other modes
                        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                            {/* LEFT: picker list */}
                            <div className="space-y-3">
                                {/* CHARGE filters */}
                                {effectiveMode === "CHARGE_ITEM" && (
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                        <div className="text-sm font-extrabold text-slate-900">Charge Master Filters</div>
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                                            <Field label="Category">
                                                <Select value={chargeCategory} onChange={(e) => setChargeCategory(e.target.value)}>
                                                    {CHARGE_CATEGORIES.map((c) => (
                                                        <option key={c.value} value={c.value}>
                                                            {c.value} — {c.label}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </Field>

                                            <Field label="Active Only">
                                                <Select value={chargeActiveOnly ? "YES" : "NO"} onChange={(e) => setChargeActiveOnly(e.target.value === "YES")}>
                                                    <option value="YES">Yes</option>
                                                    <option value="NO">No</option>
                                                </Select>
                                            </Field>

                                            {normalizeHdr(chargeCategory) === "MISC" ? (
                                                <Field label="Module Header">
                                                    <Select value={chargeModuleHeader} onChange={(e) => setChargeModuleHeader(e.target.value)}>
                                                        <option value="">All</option>
                                                        {moduleHeaderOptions.map((m) => (
                                                            <option key={m} value={m}>
                                                                {m}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </Field>
                                            ) : (
                                                <Field label=" ">
                                                    <div className="h-10" />
                                                </Field>
                                            )}

                                            {normalizeHdr(chargeCategory) === "MISC" ? (
                                                <Field label="Service Header">
                                                    <Select value={chargeServiceHeader} onChange={(e) => setChargeServiceHeader(e.target.value)}>
                                                        <option value="">All</option>
                                                        {serviceHeaderOptions.map((s) => (
                                                            <option key={s} value={s}>
                                                                {s}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </Field>
                                            ) : (
                                                <Field label=" ">
                                                    <div className="h-10" />
                                                </Field>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* MASTER extra */}
                                {effectiveMode === "MASTER" && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <Field label="Modality (Radiology optional)">
                                            <Input value={modality} onChange={(e) => setModality(e.target.value)} placeholder="XRAY / CT / MRI / US…" />
                                        </Field>
                                    </div>
                                )}

                                {/* BED extra */}
                                {effectiveMode === "BED" && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <Field label="Ward">
                                            <Select value={wardId} onChange={(e) => setWardId(e.target.value)}>
                                                <option value="">All</option>
                                                {wards.map((w) => (
                                                    <option key={w.id} value={w.id}>
                                                        {w.label}
                                                    </option>
                                                ))}
                                            </Select>
                                        </Field>

                                        <Field label="Room">
                                            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                                                <option value="">All</option>
                                                {rooms.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.label}
                                                    </option>
                                                ))}
                                            </Select>
                                        </Field>

                                        <Field label="Search Bed">
                                            <Input value={bedSearch} onChange={(e) => setBedSearch(e.target.value)} placeholder="Bed code / room / ward" />
                                        </Field>
                                    </div>
                                )}

                                {/* LIST */}
                                <div className="border rounded-2xl overflow-hidden bg-white">
                                    <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
                                        <div className="text-sm font-semibold text-slate-900">
                                            {effectiveMode === "CHARGE_ITEM"
                                                ? `Charge Items (${filteredChargeItems.length})`
                                                : effectiveMode === "BED"
                                                    ? `Beds (${beds.length})`
                                                    : `Items (${rawItems.length})`}
                                        </div>
                                        <Button variant="outline" className="gap-2" onClick={() => loadOptions(code)} disabled={optLoading}>
                                            <RefreshCcw size={16} /> Reload
                                        </Button>
                                    </div>

                                    <div className="max-h-[420px] overflow-auto">
                                        {effectiveMode === "BED" ? (
                                            beds.length === 0 ? (
                                                <div className="p-3 text-sm text-slate-500">No beds found.</div>
                                            ) : (
                                                <div className="divide-y">
                                                    {beds.map((b) => {
                                                        const price = num(b?.suggested_rate ?? b?.suggestedRate ?? b?.rate ?? 0, 0)
                                                        return (
                                                            <div key={b.id} className="p-3 flex items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="text-sm font-medium text-slate-900">{b.label}</div>
                                                                    <div className="text-xs text-slate-500">Suggested ₹{price.toFixed(2)}</div>
                                                                </div>
                                                                <Button variant="outline" className="gap-2" onClick={() => addCartRowFromBed(b)}>
                                                                    <PlusCircle size={16} /> Add
                                                                </Button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        ) : (effectiveMode === "CHARGE_ITEM" ? filteredChargeItems : rawItems).length === 0 ? (
                                            <div className="p-3 text-sm text-slate-500">No items found.</div>
                                        ) : (
                                            <div className="divide-y">
                                                {(effectiveMode === "CHARGE_ITEM" ? filteredChargeItems : rawItems).map((it) => {
                                                    const id = Number(it.id)
                                                    const label = getItemLabel(it)
                                                    const price = getItemPrice(it)
                                                    const gst = getItemGst(it)

                                                    const mh = normalizeHdr(it?.module_header || it?.moduleHeader || "")
                                                    const sh = normalizeHdr(it?.service_header || it?.serviceHeader || "")

                                                    return (
                                                        <div key={id} className="p-3 flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="text-sm font-medium text-slate-900">{label}</div>
                                                                <div className="text-xs text-slate-500">
                                                                    ₹{price.toFixed(2)} · GST {gst}%
                                                                    {effectiveMode === "CHARGE_ITEM" ? (
                                                                        <>
                                                                            {mh ? ` · Module ${mh}` : ""}
                                                                            {sh ? ` · Service ${sh}` : ""}
                                                                        </>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                            <Button variant="outline" className="gap-2" onClick={() => addCartRowFromMaster(it)}>
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

                            {/* RIGHT: Cart */}
                            <div className="space-y-3">
                                <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                                    <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
                                        <div className="text-sm font-semibold text-slate-900">Selected ({cart.length})</div>
                                        <Button variant="outline" className="gap-2" onClick={() => setCart([])} disabled={!cart.length}>
                                            <Trash2 size={16} /> Clear
                                        </Button>
                                    </div>

                                    {cart.length === 0 ? (
                                        <div className="p-3 text-sm text-slate-500">Add items from the left list.</div>
                                    ) : (
                                        <div className="p-3 space-y-3">
                                            <div className="border rounded-xl overflow-x-auto">
                                                <table className="min-w-[860px] w-full text-sm">
                                                    <thead className="bg-slate-50 border-b">
                                                        <tr className="text-left">
                                                            <th className="p-2">Item</th>
                                                            <th className="p-2 w-[160px]">Date</th>
                                                            <th className="p-2 w-[90px]">Qty</th>
                                                            <th className="p-2 w-[110px]">GST%</th>
                                                            <th className="p-2 w-[140px]">Price</th>
                                                            <th className="p-2 w-[220px]">Description</th>
                                                            <th className="p-2 w-[120px] text-right">Total</th>
                                                            <th className="p-2 w-[50px]" />
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y bg-white">
                                                        {cart.map((r) => {
                                                            const q = num(r.qty, 0)
                                                            const p = num(r.unit_price, 0)
                                                            const g = num(r.gst_rate, 0)
                                                            const line = q * p
                                                            const total = line + (line * g) / 100

                                                            const invMod =
                                                                effectiveMode === "CHARGE_ITEM" ? normalizeHdr(r.module_header) || fallbackChargeModule() : null

                                                            return (
                                                                <tr key={r.key}>
                                                                    <td className="p-2">
                                                                        <div className="font-medium text-slate-900">{r.label}</div>
                                                                        {invMod ? (
                                                                            <div className="text-xs text-slate-500">Invoice: {invMod}</div>
                                                                        ) : (
                                                                            <div className="text-xs text-slate-500">ID: {r.item_id}</div>
                                                                        )}
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
                                                                            onChange={(e) => setCart((prev) => prev.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))}
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
                                                                        />
                                                                    </td>

                                                                    <td className="p-2">
                                                                        <Input
                                                                            value={r.description}
                                                                            onChange={(e) =>
                                                                                setCart((prev) => prev.map((x) => (x.key === r.key ? { ...x, description: e.target.value } : x)))
                                                                            }
                                                                        />
                                                                    </td>

                                                                    <td className="p-2 text-right font-semibold">₹{total.toFixed(2)}</td>

                                                                    <td className="p-2">
                                                                        <Button variant="ghost" onClick={() => setCart((prev) => prev.filter((x) => x.key !== r.key))} title="Remove">
                                                                            <Trash2 size={16} />
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="text-sm text-slate-700">
                                                    <span className="font-semibold">Sub:</span> ₹{totals.sub.toFixed(2)} ·{" "}
                                                    <span className="font-semibold">Tax:</span> ₹{totals.tax.toFixed(2)} ·{" "}
                                                    <span className="font-extrabold">Total:</span> ₹{totals.total.toFixed(2)}
                                                </div>
                                                <div className="text-xs text-slate-500">Final totals computed by backend.</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => nav(-1)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={onSubmit} className="gap-2" disabled={!canSubmit}>
                                        <PlusCircle size={16} /> Add Items
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    )
}
