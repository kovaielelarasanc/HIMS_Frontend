// FILE: src/components/quickorders/RxScreen.jsx
import { useEffect, useRef, useState } from "react"
import {
    Pill,
    Search,
    Loader2,
    Trash2,
    Sparkles,
    ClipboardCopy,
    FileText,
    Eye,
    Printer,
    Download,
    ArrowLeft,
    AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

import { searchItemBatches } from "@/api/inventory"

// ✅ Alternate API: use core pharmacy API create
// NOTE: createPharmacyPrescriptionFromContext == createPharmacyPrescription (we map ctx/contextId -> visit/ipd/ot fields)
import { createPharmacyPrescription } from "@/api/pharmacyRx"

// PDF download (keep your existing quickOrders helper if you already have it)
import { downloadRxPdf } from "@/api/quickOrders"

import {
    cx,
    TONE,
    StatusChip,
    PremiumButton,
    freqToSlots,
    slotsToFreq,
    extractApiError,
} from "./_shared"

const LS_RX_TEMPLATES = "nutryah_rx_templates_v1"

// -----------------------------
// Small helpers (safe + UI)
// -----------------------------
const safeStr = (v) => (v == null ? "" : String(v)).trim()
const toInt = (v) => {
    const n = Number.parseInt(String(v ?? ""), 10)
    return Number.isFinite(n) ? n : null
}
const fmtQty = (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return "0"
    // keep nice looking qty, avoid long floats
    return n % 1 === 0 ? String(n) : n.toFixed(2)
}
const fmtDate = (iso) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleDateString()
}

// -----------------------------
// Normalize searchItemBatches response
// Supports both shapes:
//  A) [{ id/item_id, name, on_hand_qty, batches:[{batch_id,...}]}]
//  B) [{ item_id, item_name, batch_id, batch_no, exp_date, on_hand_qty }]
// Returns: [{ id, name, code, strength, form, on_hand_qty, batches:[...], batch_count }]
// -----------------------------
// ✅ qty MUST come from available_qty (fallbacks kept for safety)
export function normalizeItemBatchSearch(raw) {
    const arr = Array.isArray(raw) ? raw : []

    const toNum = (v) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : 0
    }

    const pickItemQty = (x, batches = []) => {
        // Priority: available_qty -> on_hand_qty -> qty -> available_qty (alt names) -> sum(batches)
        const direct =
            x?.available_qty ??
            x?.availableQty ??
            x?.on_hand_qty ??
            x?.onHandQty ??
            x?.qty ??
            x?.stock_qty ??
            x?.stockQty ??
            null

        if (direct != null) return toNum(direct)

        // if item qty not present, derive from batches (available_qty preferred)
        return (batches || []).reduce((s, b) => {
            const q = b?.available_qty ?? b?.availableQty ?? b?.on_hand_qty ?? b?.qty ?? 0
            return s + toNum(q)
        }, 0)
    }

    const pickBatchQty = (b) => {
        // ✅ qty = available_qty
        return toNum(b?.available_qty ?? b?.availableQty ?? b?.on_hand_qty ?? b?.qty ?? 0)
    }

    const normalizeBatch = (b) => ({
        batch_id: b?.batch_id ?? b?.id ?? null,
        batch_no: b?.batch_no ?? b?.batch_number ?? b?.batch ?? "",
        exp_date: b?.exp_date ?? b?.expiry_date ?? b?.expiry ?? null,

        // ✅ expose both keys (use whichever your UI expects)
        available_qty: pickBatchQty(b),
        on_hand_qty: pickBatchQty(b),
    })

    // -----------------------------
    // Case A: already item-level with batches
    // -----------------------------
    const looksItemLevel = arr.some((x) => Array.isArray(x?.batches))
    if (looksItemLevel) {
        return arr
            .map((x) => {
                const id = x?.id ?? x?.item_id
                if (!id) return null

                const batchesRaw = Array.isArray(x?.batches) ? x.batches : []
                const batches = batchesRaw.map(normalizeBatch).filter((b) => b.batch_id || b.batch_no)

                const total = pickItemQty(x, batches)

                return {
                    id: Number(id),
                    name: x?.name ?? x?.item_name ?? "",
                    code: x?.code ?? "",
                    strength: x?.strength ?? "",
                    form: x?.form ?? x?.uom ?? "",

                    // ✅ item stock = available_qty
                    available_qty: total,
                    on_hand_qty: total,

                    batches,
                    batch_count: batches.length,
                }
            })
            .filter(Boolean)
    }

    // -----------------------------
    // Case B: batch-row level -> group by item_id
    // -----------------------------
    const map = new Map()

    for (const r of arr) {
        const itemId = r?.item_id ?? r?.id
        if (!itemId) continue

        const key = String(itemId)
        if (!map.has(key)) {
            map.set(key, {
                id: Number(itemId),
                name: r?.item_name ?? r?.name ?? "",
                code: r?.code ?? "",
                strength: r?.strength ?? "",
                form: r?.form ?? r?.uom ?? "",
                available_qty: 0,
                on_hand_qty: 0,
                batches: [],
                batch_count: 0,
            })
        }

        const it = map.get(key)

        // ✅ row qty = available_qty
        const rowQty = toNum(r?.available_qty ?? r?.availableQty ?? r?.on_hand_qty ?? r?.qty ?? 0)
        it.available_qty += rowQty
        it.on_hand_qty += rowQty

        it.batches.push(
            normalizeBatch({
                batch_id: r?.batch_id ?? r?.id ?? null,
                batch_no: r?.batch_no ?? r?.batch_number ?? r?.batch ?? "",
                exp_date: r?.exp_date ?? r?.expiry_date ?? r?.expiry ?? null,
                available_qty: rowQty,
            })
        )
    }

    const out = Array.from(map.values()).map((it) => {
        it.batch_count = it.batches.length

        // sort batches: earliest expiry first, then qty desc
        it.batches.sort((a, b) => {
            const da = a?.exp_date ? new Date(a.exp_date).getTime() : Number.POSITIVE_INFINITY
            const db = b?.exp_date ? new Date(b.exp_date).getTime() : Number.POSITIVE_INFINITY
            if (da !== db) return da - db
            return (Number(b?.available_qty ?? 0) || 0) - (Number(a?.available_qty ?? 0) || 0)
        })

        return it
    })

    return out
}


// -----------------------------
// Map ctx/contextId -> encounter fields expected by backend
// -----------------------------
function inferEncounterType(ctx) {
    const c = safeStr(ctx).toUpperCase()
    if (!c) return null
    if (c === "OP" || c === "OPD" || c.includes("OP")) return "OP"
    if (c === "IP" || c === "IPD" || c.includes("IP")) return "IP"
    if (c === "OT" || c.includes("OT")) return "OT"
    return null
}

// If your backend expects OPD/IPD/OT/COUNTER, keep this.
// If it expects OP/IP/OT/COUNTER, change here.
function toBackendType(t) {
    const x = safeStr(t).toUpperCase()
    if (x === "OP") return "OPD"
    if (x === "IP") return "IPD"
    if (x === "OT") return "OT"
    if (x === "COUNTER") return "COUNTER"
    return x
}

export default function RxScreen({
    patient,
    ctx,
    contextId,
    canUseContext,
    onBack,
    loadSummary,
    loadingSummary,
    summaryRx = [],
    openDetails,
    defaultLocationId,
}) {
    const [rxQuery, setRxQuery] = useState("")
    const [rxOptions, setRxOptions] = useState([])
    const [rxSearching, setRxSearching] = useState(false)
    const [showRxDropdown, setShowRxDropdown] = useState(false)
    const rxDropRef = useRef(null)

    const [rxSelectedItem, setRxSelectedItem] = useState(null)

    // ✅ show batches & stock from search, optional selection
    const [rxSelectedBatchId, setRxSelectedBatchId] = useState("AUTO")

    const [rxLines, setRxLines] = useState([])

    const [rxDose, setRxDose] = useState("")
    const [rxDuration, setRxDuration] = useState("5")
    const [rxQty, setRxQty] = useState("10")
    const [rxRoute, setRxRoute] = useState("oral")
    const [rxTiming, setRxTiming] = useState("BF")
    const [rxNote, setRxNote] = useState("")
    const [rxSubmitting, setRxSubmitting] = useState(false)

    const [rxSlots, setRxSlots] = useState({ am: true, af: false, pm: false, night: true })

    const [rxTemplates, setRxTemplates] = useState(() => {
        try {
            const raw = localStorage.getItem(LS_RX_TEMPLATES)
            const arr = raw ? JSON.parse(raw) : []
            return Array.isArray(arr) ? arr : []
        } catch {
            return []
        }
    })
    const [rxTemplateId, setRxTemplateId] = useState("")
    const [lastRx, setLastRx] = useState(null)

    // Close dropdown on outside click / ESC
    useEffect(() => {
        const onDown = (e) => {
            const t = e.target
            if (rxDropRef.current && !rxDropRef.current.contains(t)) setShowRxDropdown(false)
        }
        const onKey = (e) => {
            if (e.key === "Escape") setShowRxDropdown(false)
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [])

    // Debounced inventory search (shows stock + batches)
    useEffect(() => {
        if (!rxQuery || rxQuery.trim().length < 2) {
            setRxOptions([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            try {
                setRxSearching(true)
                const res = await searchItemBatches({
                    location_id: defaultLocationId || 1,
                    q: rxQuery.trim(),
                    limit: 15,
                    type: "drug",
                    only_in_stock: true,
                    exclude_expired: true,
                    active_only: true,
                })
                if (cancelled) return

                const raw = Array.isArray(res?.data) ? res.data : []
                console.log(raw, "12345678798765");
                const items = normalizeItemBatchSearch(raw)


                setRxOptions(items)
                setShowRxDropdown(true)
            } catch (err) {
                console.error(err)
                toast.error("Failed to search medicines from inventory.")
            } finally {
                if (!cancelled) setRxSearching(false)
            }
        }, 180)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [rxQuery, defaultLocationId])

    const handleSelectRxItem = (it) => {
        setRxSelectedItem(it)
        setRxQuery(it?.name || "")
        setShowRxDropdown(false)

        // default batch selection
        const batches = Array.isArray(it?.batches) ? it.batches : []
        setRxSelectedBatchId(batches.length ? String(batches[0]?.batch_id ?? "AUTO") : "AUTO")

        // smart qty default: keep user's qty if valid; else clamp to stock
        const stock = Number(it?.on_hand_qty ?? 0)
        const curQty = Number(rxQty ?? 0)
        if (!Number.isFinite(curQty) || curQty <= 0) {
            setRxQty(stock > 0 ? String(Math.min(10, Math.ceil(stock))) : "10")
        }
    }

    const applyRxMacro = (name) => {
        if (name === "OD") setRxSlots({ am: true, af: false, pm: false, night: false })
        if (name === "BD") setRxSlots({ am: true, af: false, pm: false, night: true })
        if (name === "TID") setRxSlots({ am: true, af: true, pm: false, night: true })
        if (name === "QID") setRxSlots({ am: true, af: true, pm: true, night: true })
        if (name === "NIGHT") setRxSlots({ am: false, af: false, pm: false, night: true })
    }

    const getSelectedBatchMeta = () => {
        const batches = Array.isArray(rxSelectedItem?.batches) ? rxSelectedItem.batches : []
        if (!batches.length) return null
        if (rxSelectedBatchId === "AUTO") return batches[0]
        return batches.find((b) => String(b.batch_id) === String(rxSelectedBatchId)) || batches[0]
    }

    const handleAddRxLine = () => {
        if (!rxSelectedItem) return toast.error("Select a medicine from inventory.")
        const qty = Number.parseFloat(rxQty || "0") || 0
        const duration = Number.parseInt(rxDuration || "0", 10) || null
        if (!qty || qty <= 0) return toast.error("Enter a valid quantity.")

        const stock = Number(rxSelectedItem?.on_hand_qty ?? 0)
        if (Number.isFinite(stock) && stock > 0 && qty > stock) {
            return toast.error(`Requested qty (${fmtQty(qty)}) exceeds available stock (${fmtQty(stock)}).`)
        }

        const frequency_code = slotsToFreq(rxSlots)
        const bmeta = getSelectedBatchMeta()

        setRxLines((prev) => [
            ...prev,
            {
                item_id: rxSelectedItem.id,
                item_name: rxSelectedItem.name,
                requested_qty: qty,
                total_qty: qty,

                dose_text: rxDose || null,
                frequency_code,
                duration_days: duration,
                route: rxRoute || null,
                timing: rxTiming || null,
                instructions: null,

                // ✅ UI-only meta (DO NOT send to backend)
                _meta: {
                    stock_qty: Number(rxSelectedItem?.on_hand_qty ?? 0) || 0,
                    batch_id: bmeta?.batch_id ?? null,
                    batch_no: bmeta?.batch_no ?? "",
                    exp_date: bmeta?.exp_date ?? null,
                },
            },
        ])

        setRxSelectedItem(null)
        setRxSelectedBatchId("AUTO")
        setRxQuery("")
        setRxQty("10")
        setRxDose("")
    }

    const handleRemoveRxLine = (idx) => setRxLines((prev) => prev.filter((_, i) => i !== idx))

    const handleSubmitRx = async () => {
        if (!rxLines.length) return toast.error("Add at least one medicine.")
        if (!patient?.id) return toast.error("Missing patient for prescription.")
        if (!ctx || !contextId) return toast.error("Missing context for prescription.")

        const encType = inferEncounterType(ctx)
        const encId = toInt(contextId)
        if (!encType || !encId) return toast.error("Invalid contextType/contextId for prescription.")

        // Map encounter into correct field expected by backend
        const visit_id = encType === "OP" ? encId : null
        const ipd_admission_id = encType === "IP" ? encId : null
        const ot_case_id = encType === "OT" ? encId : null

        const payload = {
            type: toBackendType(encType),
            priority: "ROUTINE",
            rx_datetime: new Date().toISOString(),

            patient_id: toInt(patient.id),
            doctor_user_id: null,

            visit_id,
            ipd_admission_id,
            ot_case_id,

            notes: rxNote || "",

            // ✅ send only backend-expected fields
            lines: rxLines.map((l) => ({
                item_id: toInt(l.item_id),
                item_name: safeStr(l.item_name),
                strength: null,
                route: l.route || null,
                frequency_code: l.frequency_code,
                duration_days: l.duration_days ?? null,
                requested_qty: Number(l.requested_qty || 0),
                total_qty: Number(l.total_qty || l.requested_qty || 0),
                dose_text: l.dose_text || null,
                instructions: l.instructions || null,
                is_prn: false,
                is_stat: false,
            })),
        }

        setRxSubmitting(true)
        try {
            const res = await createPharmacyPrescription(payload)
            const created = res?.data?.data ?? res?.data ?? null

            toast.success("Prescription created & sent to Pharmacy.")
            setRxLines([])
            setRxNote("")
            setRxQuery("")
            setRxSelectedItem(null)
            setRxSelectedBatchId("AUTO")
            setLastRx(created && typeof created === "object" ? created : null)
            loadSummary?.()
        } catch (err) {
            console.error(err)
            toast.error(extractApiError(err, "Failed to create prescription."))
        } finally {
            setRxSubmitting(false)
        }
    }

    const rxActions = async (rxId, mode) => {
        if (!rxId) return toast.error("Invalid prescription ID")
        try {
            const res = await downloadRxPdf(rxId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            const url = URL.createObjectURL(blob)
            const w = window.open(url, "_blank", "noopener,noreferrer")
            if (mode === "print") w?.print?.()
            if (mode === "download") {
                const a = document.createElement("a")
                a.href = url
                a.download = `prescription_${rxId}.pdf`
                document.body.appendChild(a)
                a.click()
                a.remove()
            }
            setTimeout(() => URL.revokeObjectURL(url), 60_000)
        } catch (e) {
            console.error(e)
            toast.error("Prescription PDF failed")
        }
    }

    // Templates
    const applyTemplate = (tpl) => {
        if (!tpl) return
        setRxNote(tpl.note || "")
        if (tpl.defaults?.route) setRxRoute(tpl.defaults.route)
        if (tpl.defaults?.timing) setRxTiming(tpl.defaults.timing)
        if (tpl.defaults?.days) setRxDuration(String(tpl.defaults.days))
        if (tpl.defaults?.qty) setRxQty(String(tpl.defaults.qty))
        if (tpl.defaults?.slots) setRxSlots(tpl.defaults.slots)
        toast.success(`Template applied: ${tpl.name}`)
    }

    const saveCurrentAsTemplate = () => {
        const name = window.prompt("Template name? (e.g. OPD Standard)")
        if (!name) return

        const tpl = {
            id: `tpl_${Date.now()}`,
            name: name.trim(),
            note: rxNote || "",
            defaults: {
                route: rxRoute,
                timing: rxTiming,
                days: Number.parseInt(rxDuration || "0", 10) || 0,
                qty: Number.parseFloat(rxQty || "0") || 0,
                slots: rxSlots,
            },
            created_at: new Date().toISOString(),
        }

        const next = [tpl, ...(rxTemplates || [])].slice(0, 30)
        setRxTemplates(next)
        try {
            localStorage.setItem(LS_RX_TEMPLATES, JSON.stringify(next || []))
        } catch { }
        setRxTemplateId(tpl.id)
        toast.success("Template saved")
    }

    const deleteTemplate = (id) => {
        const next = (rxTemplates || []).filter((t) => t.id !== id)
        setRxTemplates(next)
        try {
            localStorage.setItem(LS_RX_TEMPLATES, JSON.stringify(next || []))
        } catch { }
        if (rxTemplateId === id) setRxTemplateId("")
        toast.success("Template deleted")
    }

    const copyScheduleText = () => {
        const s = slotsToFreq(rxSlots)
        navigator.clipboard?.writeText(s).then(
            () => toast.success(`Copied: ${s}`),
            () => toast.error("Copy failed")
        )
    }

    const selectedBatchMeta = getSelectedBatchMeta()
    const selectedStock = rxSelectedItem?.on_hand_qty ?? null

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <PremiumButton tone="slate" variant="outline" className="h-10" onClick={onBack} type="button">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </PremiumButton>
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                            <Pill className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-900">Pharmacy Prescription</div>
                            <div className="text-[11px] text-slate-500">
                                Fast Rx creation — inventory search (stock + batches) + schedule macros.
                            </div>
                        </div>
                    </div>
                </div>

                <StatusChip tone="rx">{rxLines.length} line(s)</StatusChip>
            </div>

            {!canUseContext && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>Missing patient/context. Ensure patient + contextType(OP/IP/OT) + contextId.</div>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
                {/* Left: Create */}
                <div className="space-y-3">
                    <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-xs font-semibold flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-emerald-600" />
                                Macros & Templates
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <PremiumButton type="button" tone="rx" variant="outline" className="h-9 text-[11px]" onClick={copyScheduleText}>
                                    <ClipboardCopy className="h-4 w-4 mr-2" />
                                    Copy schedule
                                </PremiumButton>

                                <PremiumButton type="button" tone="rx" variant="outline" className="h-9 text-[11px]" onClick={saveCurrentAsTemplate}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Save template
                                </PremiumButton>

                                <select
                                    className="h-9 rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-800"
                                    value={rxTemplateId}
                                    onChange={(e) => {
                                        const id = e.target.value
                                        setRxTemplateId(id)
                                        const tpl = (rxTemplates || []).find((t) => t.id === id)
                                        if (tpl) applyTemplate(tpl)
                                    }}
                                >
                                    <option value="">Select template…</option>
                                    {(rxTemplates || []).map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>

                                {rxTemplateId && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-9 rounded-2xl text-[11px] text-rose-600 hover:text-rose-700"
                                        onClick={() => deleteTemplate(rxTemplateId)}
                                        title="Delete selected template"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </Button>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 items-center">
                                {["OD", "BD", "TID", "QID", "NIGHT"].map((m) => (
                                    <PremiumButton
                                        key={m}
                                        type="button"
                                        tone="rx"
                                        variant="outline"
                                        className="h-9 rounded-full text-[11px]"
                                        onClick={() => applyRxMacro(m)}
                                    >
                                        {m}
                                    </PremiumButton>
                                ))}
                                <span className="ml-1 text-[11px] text-slate-500 inline-flex items-center">
                                    Schedule: <span className="ml-1 font-semibold text-slate-900">{slotsToFreq(rxSlots)}</span>
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Search + Form */}
                    <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-xs font-semibold flex items-center gap-2">
                                <Pill className="h-4 w-4 text-emerald-600" />
                                Create Prescription
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="px-4 pb-4 pt-0 space-y-3">
                            {/* Search */}
                            <div ref={rxDropRef} className="space-y-1.5 relative">
                                <label className="text-xs font-medium text-slate-600">Search medicine (Inventory)</label>
                                <div className="relative">
                                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-3" />
                                    <Input
                                        value={rxQuery}
                                        onChange={(e) => {
                                            setRxQuery(e.target.value)
                                            setShowRxDropdown(true)
                                        }}
                                        placeholder="Search drug name / brand / generic…"
                                        className="h-10 text-xs pl-7 rounded-2xl"
                                    />
                                </div>

                                {/* ✅ Dropdown shows Stock + Batch info */}
                                {showRxDropdown && (rxOptions.length > 0 || rxSearching) && (
                                    <div className="absolute z-30 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl max-h-72 overflow-auto text-xs">
                                        {rxSearching && (
                                            <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Searching…
                                            </div>
                                        )}
                                        {!rxSearching && !rxOptions.length && <div className="px-3 py-2 text-slate-500">No items found.</div>}

                                        {!rxSearching &&
                                            rxOptions.map((it) => {
                                                const b = Array.isArray(it?.batches) ? it.batches : []
                                                const top = b?.[0]
                                                return (
                                                    <button
                                                        key={it.id}
                                                        type="button"
                                                        onClick={() => handleSelectRxItem(it)}
                                                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                    >
                                                        <div className="flex justify-between items-center gap-2">
                                                            <span className="font-medium text-slate-900 truncate">{it.name}</span>
                                                            <span className="text-[10px] text-slate-500 shrink-0">
                                                                Stock: <span className="font-semibold text-slate-800">{fmtQty(it.on_hand_qty)}</span>
                                                            </span>
                                                        </div>

                                                        <div className="flex justify-between items-center gap-2">
                                                            <span className="text-[11px] text-slate-500 truncate">
                                                                {[it.strength, it.form].filter(Boolean).join(" • ") || "—"}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 shrink-0">
                                                                Batches: <span className="font-semibold text-slate-800">{b.length}</span>
                                                            </span>
                                                        </div>

                                                        {top?.batch_no && (
                                                            <span className="text-[10px] text-slate-500 truncate">
                                                                Top batch:{" "}
                                                                <span className="font-semibold text-slate-800">{top.batch_no}</span>
                                                                {top.exp_date ? ` • Exp ${fmtDate(top.exp_date)}` : ""}
                                                                {Number.isFinite(Number(top.on_hand_qty)) ? ` • Qty ${fmtQty(top.on_hand_qty)}` : ""}
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* ✅ Selected item quick info (Stock + Batch selector) */}
                            {rxSelectedItem && (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-[12px] font-semibold text-slate-900 truncate">{rxSelectedItem.name}</div>
                                            <div className="text-[11px] text-slate-600">
                                                Stock: <span className="font-semibold">{fmtQty(selectedStock)}</span>
                                                {selectedBatchMeta?.batch_no ? (
                                                    <>
                                                        {" "}
                                                        • Batch: <span className="font-semibold">{selectedBatchMeta.batch_no}</span>
                                                        {selectedBatchMeta?.exp_date ? ` • Exp ${fmtDate(selectedBatchMeta.exp_date)}` : ""}
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>

                                        {Array.isArray(rxSelectedItem?.batches) && rxSelectedItem.batches.length > 0 && (
                                            <select
                                                className="h-9 rounded-2xl border border-emerald-200 bg-white px-3 text-[11px] font-semibold text-slate-800"
                                                value={rxSelectedBatchId}
                                                onChange={(e) => setRxSelectedBatchId(e.target.value)}
                                                title="Batch (for display / availability check)"
                                            >
                                                <option value="AUTO">AUTO (earliest expiry)</option>
                                                {rxSelectedItem.batches.map((b) => (
                                                    <option key={String(b.batch_id ?? b.batch_no)} value={String(b.batch_id ?? "")}>
                                                        {b.batch_no || `Batch-${b.batch_id}`} • Qty {fmtQty(b.on_hand_qty)}
                                                        {b.exp_date ? ` • Exp ${fmtDate(b.exp_date)}` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-600">Dosage</label>
                                    <Input
                                        value={rxDose}
                                        onChange={(e) => setRxDose(e.target.value)}
                                        placeholder="500mg / 1 tab"
                                        className="h-9 text-[11px] rounded-2xl"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-600">Days</label>
                                    <Input
                                        value={rxDuration}
                                        onChange={(e) => setRxDuration(e.target.value)}
                                        placeholder="5"
                                        className="h-9 text-[11px] rounded-2xl"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-600">
                                        Qty {rxSelectedItem?.on_hand_qty != null ? <span className="text-slate-500">(Avail {fmtQty(rxSelectedItem.on_hand_qty)})</span> : null}
                                    </label>
                                    <Input
                                        value={rxQty}
                                        onChange={(e) => setRxQty(e.target.value)}
                                        placeholder="10"
                                        className="h-9 text-[11px] rounded-2xl"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-600">Timing</label>
                                    <select
                                        className="h-9 w-full rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-800"
                                        value={rxTiming}
                                        onChange={(e) => setRxTiming(e.target.value)}
                                    >
                                        <option value="BF">Before food (BF)</option>
                                        <option value="AF">After food (AF)</option>
                                        <option value="NA">No timing</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-600">Route</label>
                                    <select
                                        className="h-9 w-full rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-800"
                                        value={rxRoute}
                                        onChange={(e) => setRxRoute(e.target.value)}
                                    >
                                        <option value="oral">Oral</option>
                                        <option value="iv">IV</option>
                                        <option value="im">IM</option>
                                        <option value="topical">Topical</option>
                                        <option value="inhalation">Inhalation</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-600">Schedule (AM / AF / PM / NIGHT)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            ["am", "AM"],
                                            ["af", "AF"],
                                            ["pm", "PM"],
                                            ["night", "NIGHT"],
                                        ].map(([k, label]) => {
                                            const on = !!rxSlots[k]
                                            return (
                                                <button
                                                    key={k}
                                                    type="button"
                                                    onClick={() => setRxSlots((s) => ({ ...s, [k]: !s[k] }))}
                                                    className={cx(
                                                        "h-9 px-4 rounded-full border text-[11px] font-semibold transition-all",
                                                        on ? TONE.rx.solid : "bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <PremiumButton type="button" tone="rx" variant="solid" className="h-9 px-4 text-[11px] rounded-full" onClick={handleAddRxLine}>
                                    Add line
                                </PremiumButton>
                            </div>

                            {/* Lines */}
                            {rxLines.length > 0 && (
                                <div className="border border-slate-200 rounded-2xl bg-slate-50/60 overflow-hidden">
                                    <ScrollArea className="max-h-64">
                                        <div className="min-w-[980px]">
                                            <table className="w-full text-[11px]">
                                                <thead className="bg-slate-100 text-slate-700">
                                                    <tr>
                                                        <th className="px-2 py-2 text-left font-semibold">S.NO</th>
                                                        <th className="px-2 py-2 text-left font-semibold">Drug/Medicine</th>
                                                        <th className="px-2 py-2 text-left font-semibold">Batch</th>
                                                        <th className="px-2 py-2 text-left font-semibold">Dosage</th>
                                                        <th className="px-2 py-2 text-center font-semibold">AM</th>
                                                        <th className="px-2 py-2 text-center font-semibold">AF</th>
                                                        <th className="px-2 py-2 text-center font-semibold">PM</th>
                                                        <th className="px-2 py-2 text-center font-semibold">NIGHT</th>
                                                        <th className="px-2 py-2 text-center font-semibold">DAYS</th>
                                                        <th className="px-2 py-2 text-right font-semibold">Qty</th>
                                                        <th className="px-2 py-2 text-right font-semibold">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white">
                                                    {rxLines.map((l, idx) => {
                                                        const s = freqToSlots(l.frequency_code)
                                                        const dosage = [l.dose_text, l.route, l.timing].filter(Boolean).join(" • ")
                                                        const bno = l?._meta?.batch_no || "—"
                                                        const exp = l?._meta?.exp_date ? fmtDate(l._meta.exp_date) : ""
                                                        return (
                                                            <tr key={idx} className="border-t border-slate-100">
                                                                <td className="px-2 py-2 text-slate-500">{idx + 1}</td>
                                                                <td className="px-2 py-2 font-medium text-slate-900">{l.item_name}</td>
                                                                <td className="px-2 py-2 text-slate-700">
                                                                    <div className="font-semibold text-slate-900">{bno}</div>
                                                                    {exp ? <div className="text-[10px] text-slate-500">Exp {exp}</div> : null}
                                                                </td>
                                                                <td className="px-2 py-2 text-slate-700">{dosage || "—"}</td>
                                                                <td className="px-2 py-2 text-center font-semibold">{s.am}</td>
                                                                <td className="px-2 py-2 text-center font-semibold">{s.af}</td>
                                                                <td className="px-2 py-2 text-center font-semibold">{s.pm}</td>
                                                                <td className="px-2 py-2 text-center font-semibold">{s.night}</td>
                                                                <td className="px-2 py-2 text-center font-semibold">{l.duration_days ?? "—"}</td>
                                                                <td className="px-2 py-2 text-right font-semibold text-slate-800">{fmtQty(l.requested_qty)}</td>
                                                                <td className="px-2 py-2 text-right">
                                                                    <Button
                                                                        type="button"
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-2xl"
                                                                        onClick={() => handleRemoveRxLine(idx)}
                                                                        title="Remove"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Clinical notes / Rx note (optional)</label>
                                <Textarea
                                    rows={2}
                                    value={rxNote}
                                    onChange={(e) => setRxNote(e.target.value)}
                                    className="resize-none text-xs rounded-2xl"
                                />
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {lastRx?.id && (
                                    <>
                                        <PremiumButton type="button" tone="rx" variant="outline" className="h-10" onClick={() => rxActions(lastRx.id, "view")}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            View PDF
                                        </PremiumButton>
                                        <PremiumButton type="button" tone="rx" variant="outline" className="h-10" onClick={() => rxActions(lastRx.id, "print")}>
                                            <Printer className="h-4 w-4 mr-2" />
                                            Print
                                        </PremiumButton>
                                        <PremiumButton type="button" tone="rx" variant="solid" className="h-10" onClick={() => rxActions(lastRx.id, "download")}>
                                            <Download className="h-4 w-4 mr-2" />
                                            Download
                                        </PremiumButton>
                                    </>
                                )}

                                <PremiumButton
                                    type="button"
                                    tone="rx"
                                    variant="solid"
                                    disabled={rxSubmitting || !canUseContext}
                                    onClick={handleSubmitRx}
                                    className="h-10 px-5 text-xs"
                                >
                                    {rxSubmitting ? "Saving Rx…" : "Save & Send to Pharmacy"}
                                </PremiumButton>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Recent */}
                <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Pill className="h-4 w-4 text-emerald-600" />
                            <CardTitle className="text-xs font-semibold">Recent Prescriptions</CardTitle>
                        </div>
                        <StatusChip tone="rx">{summaryRx?.length || 0}</StatusChip>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="space-y-2 max-h-[34rem] overflow-auto text-[11px]">
                            {!summaryRx?.length && !loadingSummary && <div className="text-slate-500 text-[12px]">No prescriptions yet.</div>}
                            {summaryRx?.map((o) => (
                                <div key={o.id} className="flex items-stretch gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openDetails?.("rx", o)}
                                        className="flex-1 text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-semibold text-slate-900 truncate">{o.rx_number || `RX-${String(o.id).padStart(6, "0")}`}</span>
                                            <span className="text-[10px] text-slate-500 truncate">{o.rx_datetime || o.created_at || "—"}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-600 capitalize shrink-0">{o.status || "pending"}</span>
                                    </button>

                                    <PremiumButton type="button" tone="rx" variant="outline" size="icon" className="h-10 w-10" title="View PDF" onClick={() => rxActions(o.id, "view")}>
                                        <Eye className="h-4 w-4" />
                                    </PremiumButton>
                                    <PremiumButton type="button" tone="rx" variant="outline" size="icon" className="h-10 w-10" title="Download PDF" onClick={() => rxActions(o.id, "download")}>
                                        <Download className="h-4 w-4" />
                                    </PremiumButton>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
