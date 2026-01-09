// FILE: frontend/src/ot/tabs/CountsTab.jsx
import { useEffect, useMemo, useState, useCallback } from "react"
import {
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    Plus,
    Search,
    Trash2,
    RefreshCcw,
    ClipboardCheck,
    ListChecks,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { useCan } from "../../hooks/useCan"
import {
    getCountsRecord,
    createCountsRecord,
    updateCountsRecord,
    listCountsItems,
    upsertCountsItems,
    deleteCountsItem,
} from "../../api/ot"
import { listOtInstruments } from "../../api/otMasters"
import { formatIST } from "@/ipd/components/timeZONE"

// ---------- helpers ----------
function toIntOrNull(val) {
    if (val === "" || val === null || val === undefined) return null
    const n = Number(val)
    return Number.isFinite(n) ? n : null
}
function toIntOrZero(val) {
    const n = Number(val)
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}
const cx = (...a) => a.filter(Boolean).join(" ")
const isBlank = (v) => v === null || v === undefined || String(v).trim() === ""

const STAGES = [
    {
        key: "PRE_INCISION",
        title: "Before incision",
        hint: "Record initial counts (baseline).",
        icon: ClipboardCheck,
    },
    {
        key: "INTRA_OP",
        title: "During case",
        hint: "Track added sponges/instruments.",
        icon: ListChecks,
    },
    {
        key: "BEFORE_CLOSURE",
        title: "Before closure",
        hint: "Enter final counts and verify match.",
        icon: AlertTriangle,
    },
    {
        key: "FINAL_SIGNOFF",
        title: "Final sign-off",
        hint: "If mismatch, document reconciliation & resolver.",
        icon: CheckCircle2,
    },
]

function useLocalStage(caseId) {
    const key = useMemo(() => `ot.counts.stage.${caseId}`, [caseId])
    const [stage, setStage] = useState("PRE_INCISION")

    useEffect(() => {
        try {
            const saved = localStorage.getItem(key)
            if (saved && STAGES.some((s) => s.key === saved)) setStage(saved)
        } catch {
            // ignore
        }
    }, [key])

    const set = useCallback(
        (next) => {
            setStage(next)
            try {
                localStorage.setItem(key, next)
            } catch {
                // ignore
            }
        },
        [key]
    )

    return [stage, set]
}

function CountsTab({ caseId }) {
    // ✅ Permission mapping should match backend:
    // ("ot.counts", ["view","create","update"])
    const canView =
        useCan("ot.cases.view") || useCan("ot.counts.view") || useCan("ipd.view")
    const canEdit =
        useCan("ot.counts.create") ||
        useCan("ot.counts.update") ||
        useCan("ipd.doctor") ||
        useCan("ipd.nursing")

    const [data, setData] = useState(null)

    // Summary (existing fields) - keep
    const [form, setForm] = useState({
        sponges_initial: "",
        sponges_added: "",
        sponges_final: "",
        instruments_initial: "", // kept (auto from lines if lines enabled)
        instruments_final: "", // kept (auto from lines if lines enabled)
        needles_initial: "",
        needles_final: "",
        discrepancy_text: "",
        xray_done: false,
        resolved_by: "",
        notes: "",
    })

    // EXTREME: instrument lines
    const [itemsEnabled, setItemsEnabled] = useState(true)
    const [lines, setLines] = useState([]) // [{id, instrument_id, instrument_code, instrument_name, uom, initial_qty, added_qty, final_qty, remarks}]
    const [masters, setMasters] = useState([])
    const [addOpen, setAddOpen] = useState(false)
    const [masterQuery, setMasterQuery] = useState("")
    const [mastersLoading, setMastersLoading] = useState(false)

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const [stage, setStage] = useLocalStage(caseId)

    const lastStamp = data?.updated_at || data?.created_at

    const banner = useMemo(() => {
        if (error) {
            return (
                <div className="mb-3 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )
        }
        if (success) {
            return (
                <div className="mb-3 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{success}</span>
                </div>
            )
        }
        return null
    }, [error, success])

    const totals = useMemo(() => {
        const initial = lines.reduce((s, x) => s + toIntOrZero(x.initial_qty), 0)
        const added = lines.reduce((s, x) => s + toIntOrZero(x.added_qty), 0)
        const expected = initial + added
        const final = lines.reduce((s, x) => s + toIntOrZero(x.final_qty), 0)
        const variance = final - expected

        const mismatchLines = lines
            .map((x) => {
                const i = toIntOrZero(x.initial_qty)
                const a = toIntOrZero(x.added_qty)
                const f = toIntOrZero(x.final_qty)
                const exp = i + a
                const varr = f - exp
                return {
                    ...x,
                    expected_final: exp,
                    variance: varr,
                    hasMismatch: varr !== 0,
                }
            })
            .filter((x) => x.hasMismatch)

        return {
            initial,
            added,
            expected,
            final,
            variance,
            mismatchLines,
            mismatchCount: mismatchLines.length,
        }
    }, [lines])

    const overallDiscrepancy = useMemo(() => {
        const spongeInit = toIntOrZero(form.sponges_initial)
        const spongeAdd = toIntOrZero(form.sponges_added)
        const spongeFinal = toIntOrZero(form.sponges_final)
        const spongeExpected = spongeInit + spongeAdd
        const spongeMismatch = spongeFinal !== spongeExpected

        const needlesInit = toIntOrZero(form.needles_initial)
        const needlesFinal = toIntOrZero(form.needles_final)
        const needlesMismatch = needlesFinal !== needlesInit

        const instMismatch = itemsEnabled ? totals.mismatchCount > 0 : false
        return spongeMismatch || needlesMismatch || instMismatch
    }, [form, totals, itemsEnabled])

    // ---------------- Soft workflow warnings (NO blocking) ----------------
    const softWarnings = useMemo(() => {
        const w = []

        const spongeInit = toIntOrZero(form.sponges_initial)
        const spongeAdd = toIntOrZero(form.sponges_added)
        const spongeFinal = toIntOrZero(form.sponges_final)
        const spongeExpected = spongeInit + spongeAdd

        const needlesInit = toIntOrZero(form.needles_initial)
        const needlesFinal = toIntOrZero(form.needles_final)

        const needInitialCore = stage === "PRE_INCISION"
        const needFinalCore = stage === "BEFORE_CLOSURE" || stage === "FINAL_SIGNOFF"

        if (needInitialCore) {
            if (isBlank(form.sponges_initial)) w.push("Sponges initial is not filled (baseline).")
            if (isBlank(form.needles_initial)) w.push("Needles initial is not filled (baseline).")
            if (itemsEnabled && lines.length === 0) w.push("No instrument lines added yet (recommended for advanced tracking).")
        }

        if (stage === "INTRA_OP") {
            // soft reminders only
            if (itemsEnabled && lines.length > 0) {
                const anyAdded = lines.some((x) => toIntOrZero(x.added_qty) > 0)
                const spongeAdded = toIntOrZero(form.sponges_added) > 0
                if (!anyAdded && !spongeAdded) {
                    w.push("If additional items were opened during the case, record them under 'Added'.")
                }
            }
        }

        if (needFinalCore) {
            if (isBlank(form.sponges_final)) w.push("Sponges final is not filled (final reconciliation).")
            if (isBlank(form.needles_final)) w.push("Needles final is not filled (final reconciliation).")

            if (itemsEnabled && lines.length > 0) {
                const missingFinal = lines.filter((x) => isBlank(x.final_qty))
                if (missingFinal.length > 0) {
                    w.push(`Final qty missing for ${missingFinal.length} instrument line(s).`)
                }
            }

            // mismatch warnings (still non-blocking)
            if (!isBlank(form.sponges_final) && spongeFinal !== spongeExpected) {
                w.push(`Sponges mismatch: expected ${spongeExpected}, final ${spongeFinal}.`)
            }
            if (!isBlank(form.needles_final) && needlesFinal !== needlesInit) {
                w.push(`Needles mismatch: expected ${needlesInit}, final ${needlesFinal}.`)
            }
            if (itemsEnabled && totals.mismatchCount > 0) {
                w.push(`Instrument mismatch in ${totals.mismatchCount} line(s). Please review variance/remarks.`)
            }
        }

        if (stage === "FINAL_SIGNOFF" && overallDiscrepancy) {
            if (isBlank(form.discrepancy_text)) w.push("Discrepancy text is empty (recommended when mismatch exists).")
            if (isBlank(form.resolved_by)) w.push("Resolved by is empty (recommended when mismatch exists).")
            if (isBlank(form.notes)) w.push("Notes / corrective action is empty (recommended when mismatch exists).")
        }

        return w
    }, [stage, form, itemsEnabled, lines, totals.mismatchCount, overallDiscrepancy, totals])

    const statusMeta = useMemo(() => {
        if (overallDiscrepancy) {
            return {
                tone: "danger",
                label: "DISCREPANCY",
                sub: "Mismatch detected — document actions and resolver (warning only).",
            }
        }
        if (softWarnings.length > 0) {
            return {
                tone: "warn",
                label: "NEEDS REVIEW",
                sub: "Some recommended fields/checks are pending (warning only).",
            }
        }
        return {
            tone: "ok",
            label: "ALL MATCH",
            sub: "Counts look consistent.",
        }
    }, [overallDiscrepancy, softWarnings.length])

    const loadCounts = async () => {
        if (!canView) return
        const res = await getCountsRecord(caseId)
        const c = res?.data
        if (c) {
            setData(c)
            setForm({
                sponges_initial: c.sponges_initial ?? "",
                sponges_added: c.sponges_added ?? "",
                sponges_final: c.sponges_final ?? "",
                instruments_initial: c.instruments_initial ?? "",
                instruments_final: c.instruments_final ?? "",
                needles_initial: c.needles_initial ?? "",
                needles_final: c.needles_final ?? "",
                discrepancy_text: c.discrepancy_text || "",
                xray_done: !!c.xray_done,
                resolved_by: c.resolved_by || "",
                notes: c.notes || "",
            })
        } else {
            setData(null)
        }
    }

    const loadLines = async () => {
        try {
            const res = await listCountsItems(caseId)
            setLines(Array.isArray(res?.data) ? res.data : [])
            setItemsEnabled(true)
        } catch (err) {
            // If API not deployed yet, fallback to summary mode
            const status = err?.response?.status
            if (status === 404 || status === 405) {
                setItemsEnabled(false)
                setLines([])
            } else {
                console.error("Failed to load counts items", err)
                setItemsEnabled(false)
                setLines([])
            }
        }
    }

    const loadAll = useCallback(async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            setSuccess(null)
            await Promise.all([loadCounts(), loadLines()])
        } catch (err) {
            console.error("Failed to load counts", err)
            setError("Failed to load counts record.")
        } finally {
            setLoading(false)
        }
    }, [caseId, canView])

    useEffect(() => {
        setData(null)
        setLines([])
        loadAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, canView])

    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You do not have permission to view sponge/instrument counts.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const buildPayload = () => {
        // Instruments summary:
        // - If item lines enabled, take totals (source of truth)
        // - Else fallback to manual fields
        const instruments_initial = itemsEnabled ? totals.initial : toIntOrNull(form.instruments_initial)
        const instruments_final = itemsEnabled ? totals.final : toIntOrNull(form.instruments_final)

        return {
            sponges_initial: toIntOrNull(form.sponges_initial),
            sponges_added: toIntOrNull(form.sponges_added),
            sponges_final: toIntOrNull(form.sponges_final),
            instruments_initial,
            instruments_final,
            needles_initial: toIntOrNull(form.needles_initial),
            needles_final: toIntOrNull(form.needles_final),
            discrepancy_text: form.discrepancy_text || null,
            xray_done: !!form.xray_done,
            resolved_by: form.resolved_by || null,
            notes: form.notes || null,
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()
        if (!canEdit) {
            setError("You do not have permission to edit counts.")
            return
        }

        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            // 1) Save summary via existing endpoint
            const payload = buildPayload()
            if (data?.id) {
                await updateCountsRecord(caseId, payload)
            } else {
                try {
                    await createCountsRecord(caseId, payload)
                } catch (err) {
                    const status = err?.response?.status
                    const detail = err?.response?.data?.detail
                    if (
                        status === 400 &&
                        typeof detail === "string" &&
                        detail.toLowerCase().includes("already exists")
                    ) {
                        await updateCountsRecord(caseId, payload)
                    } else {
                        throw err
                    }
                }
            }

            // 2) Save instrument lines (if enabled)
            if (itemsEnabled) {
                const cleanLines = lines.map((x) => ({
                    id: x.id ?? null,
                    instrument_id: x.instrument_id ?? null,
                    initial_qty: toIntOrZero(x.initial_qty),
                    added_qty: toIntOrZero(x.added_qty),
                    final_qty: toIntOrZero(x.final_qty),
                    remarks: x.remarks || "",
                }))
                await upsertCountsItems(caseId, { lines: cleanLines })
            }

            await loadAll()
            const warn = overallDiscrepancy || softWarnings.length > 0
            setSuccess(warn ? "Counts saved (with warnings)." : "Counts saved.")
            if (warn) {
                toast("Counts saved (warning only)", {
                    description: overallDiscrepancy
                        ? "Discrepancy detected. Please document reconciliation & resolver."
                        : "Some recommended checks are pending.",
                })
            } else {
                toast.success("Counts saved")
            }
        } catch (err) {
            console.error("Failed to save counts", err)
            const msg = err?.response?.data?.detail || err?.message || "Failed to save counts."
            setError(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const NumField = ({
        field,
        label,
        hint,
        disabled = false,
        valueOverride,
        tone,
    }) => {
        const value = valueOverride !== undefined ? valueOverride : form[field]
        const borderTone =
            tone === "danger"
                ? "border-rose-300 bg-rose-50 focus:border-rose-400"
                : tone === "warn"
                    ? "border-amber-300 bg-amber-50 focus:border-amber-400"
                    : "border-slate-300 bg-slate-50 focus:border-slate-400"

        return (
            <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">
                    {label}
                    {hint ? <span className="ml-1 font-normal text-slate-500">({hint})</span> : null}
                </span>
                <input
                    type="number"
                    inputMode="numeric"
                    className={cx(
                        "h-9 w-full rounded-xl border px-3 text-[12px] text-slate-900 outline-none transition focus:bg-white disabled:cursor-not-allowed disabled:opacity-60",
                        borderTone
                    )}
                    value={value}
                    disabled={!canEdit || disabled}
                    onChange={(e) => handleChange(field, e.target.value)}
                />
            </label>
        )
    }

    const updateLine = (idx, patch) => {
        setLines((prev) => {
            const next = [...prev]
            next[idx] = { ...next[idx], ...patch }
            return next
        })
    }

    const removeLine = async (line) => {
        if (!canEdit) return
        // Optimistic UI
        setLines((prev) => prev.filter((x) => x.instrument_id !== line.instrument_id))
        try {
            if (line?.id) await deleteCountsItem(caseId, line.id)
            toast.success("Instrument removed")
        } catch (err) {
            toast.error("Failed to remove instrument")
            await loadLines()
        }
    }

    const openAdd = async () => {
        if (!canEdit) return
        setAddOpen(true)
        if (masters.length > 0) return
        try {
            setMastersLoading(true)
            const res = await listOtInstruments({ search: "", active: true, limit: 200 })
            setMasters(Array.isArray(res?.data) ? res.data : [])
        } catch (err) {
            toast.error("Failed to load instrument masters")
        } finally {
            setMastersLoading(false)
        }
    }

    const filteredMasters = useMemo(() => {
        const q = masterQuery.trim().toLowerCase()
        const used = new Set(lines.map((x) => x.instrument_id).filter(Boolean))
        return masters
            .filter((m) => !used.has(m.id))
            .filter((m) => {
                if (!q) return true
                return (
                    String(m.code || "").toLowerCase().includes(q) ||
                    String(m.name || "").toLowerCase().includes(q)
                )
            })
            .slice(0, 80)
    }, [masters, masterQuery, lines])

    const addInstrument = (m) => {
        setLines((prev) => [
            ...prev,
            {
                id: null,
                instrument_id: m.id,
                instrument_code: m.code || "",
                instrument_name: m.name || "",
                uom: m.uom || "Nos",
                initial_qty: 0,
                added_qty: 0,
                final_qty: 0,
                remarks: "",
            },
        ])
        toast.success("Instrument added")
    }

    const StageIcon = (STAGES.find((s) => s.key === stage) || STAGES[0]).icon

    // For soft highlighting in summary
    const spExpected = toIntOrZero(form.sponges_initial) + toIntOrZero(form.sponges_added)
    const spFinal = toIntOrZero(form.sponges_final)
    const spMismatch = !isBlank(form.sponges_final) && spFinal !== spExpected

    const ndInit = toIntOrZero(form.needles_initial)
    const ndFinal = toIntOrZero(form.needles_final)
    const ndMismatch = !isBlank(form.needles_final) && ndFinal !== ndInit

    const instMismatch = itemsEnabled ? totals.mismatchCount > 0 : false

    const topTone =
        statusMeta.tone === "danger"
            ? "border-rose-200 bg-rose-50"
            : statusMeta.tone === "warn"
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"

    return (
        <form
            onSubmit={handleSave}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
        >
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3"
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border bg-slate-50 text-slate-700">
                            <StageIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900 md:text-base">
                                OT Sponge / Instrument / Needle Counts
                            </span>
                            <span className="text-[11px] text-slate-500">
                                Soft workflow (warnings only) • Safe reconciliation trail
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {lastStamp && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Updated: {formatIST(lastStamp)}
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={loadAll}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Refresh
                        </button>

                        {canEdit && (
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-900 bg-slate-900 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving && (
                                    <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                                )}
                                Save counts
                            </button>
                        )}
                    </div>
                </div>

                {/* Stage selector (soft) */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="text-[12px] font-semibold text-slate-800">
                            Workflow stage (optional):{" "}
                            <span className="font-normal text-slate-600">
                                used only for guidance (not blocking)
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {STAGES.map((s) => {
                                const active = stage === s.key
                                const Ico = s.icon
                                return (
                                    <button
                                        key={s.key}
                                        type="button"
                                        onClick={() => setStage(s.key)}
                                        className={cx(
                                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                                            active
                                                ? "border-slate-900 bg-white text-slate-900 shadow-sm"
                                                : "border-slate-200 bg-white/60 text-slate-700 hover:bg-white"
                                        )}
                                        title={s.hint}
                                    >
                                        <Ico className="h-4 w-4" />
                                        {s.title}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-600">
                            Tip: complete{" "}
                            <span className="font-semibold text-slate-800">Before incision</span>{" "}
                            baseline → update during case → reconcile before closure.
                        </div>
                        <div
                            className={cx(
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold",
                                topTone
                            )}
                        >
                            {statusMeta.tone === "danger" ? (
                                <AlertTriangle className="h-4 w-4 text-rose-700" />
                            ) : statusMeta.tone === "warn" ? (
                                <AlertCircle className="h-4 w-4 text-amber-700" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                            )}
                            <span
                                className={cx(
                                    statusMeta.tone === "danger"
                                        ? "text-rose-700"
                                        : statusMeta.tone === "warn"
                                            ? "text-amber-700"
                                            : "text-emerald-700"
                                )}
                            >
                                {statusMeta.label}
                            </span>
                            <span className="font-normal text-slate-600 hidden sm:inline">
                                • {statusMeta.sub}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {banner}

            {/* Soft warnings panel (non-blocking) */}
            {(softWarnings.length > 0 || overallDiscrepancy) && !loading && (
                <div
                    className={cx(
                        "rounded-2xl border px-3 py-2 text-[12px]",
                        overallDiscrepancy
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : "border-amber-200 bg-amber-50 text-amber-900"
                    )}
                >
                    <div className="flex items-start gap-2">
                        {overallDiscrepancy ? (
                            <AlertTriangle className="mt-0.5 h-4 w-4" />
                        ) : (
                            <AlertCircle className="mt-0.5 h-4 w-4" />
                        )}
                        <div className="flex-1">
                            <div className="font-semibold">
                                {overallDiscrepancy ? "Discrepancy detected" : "Recommended checks"}
                                <span className="ml-2 font-normal opacity-80">(warnings only — save is allowed)</span>
                            </div>

                            {softWarnings.length > 0 && (
                                <ul className="mt-1 list-disc pl-5">
                                    {softWarnings.slice(0, 6).map((x, i) => (
                                        <li key={i}>{x}</li>
                                    ))}
                                </ul>
                            )}

                            {overallDiscrepancy && (
                                <div className="mt-2 text-[11px] opacity-90">
                                    Recommended: recount field & tray, check bins/suction, repeat count, then document
                                    discrepancy + resolver.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="space-y-2">
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
            ) : (
                <>
                    {/* SUMMARY */}
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        {/* Sponges */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-[12px] font-semibold text-slate-800">Sponges (Summary)</div>
                                <span
                                    className={cx(
                                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                        spMismatch ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                                    )}
                                >
                                    {spMismatch ? "Mismatch" : "OK"}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-1">
                                <NumField field="sponges_initial" label="Initial" />
                                <NumField field="sponges_added" label="Added during case" />
                                <NumField
                                    field="sponges_final"
                                    label="Final count"
                                    tone={spMismatch ? "danger" : undefined}
                                />
                            </div>

                            <div className="mt-2 text-[11px] text-slate-600">
                                Expected Final:{" "}
                                <span className="font-semibold text-slate-800">{spExpected}</span>
                            </div>
                        </div>

                        {/* Needles */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-[12px] font-semibold text-slate-800">Needles / Sharps (Summary)</div>
                                <span
                                    className={cx(
                                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                        ndMismatch ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                                    )}
                                >
                                    {ndMismatch ? "Mismatch" : "OK"}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1">
                                <NumField field="needles_initial" label="Needles - Initial" />
                                <NumField
                                    field="needles_final"
                                    label="Needles - Final"
                                    tone={ndMismatch ? "danger" : undefined}
                                />
                            </div>

                            <div className="mt-2 text-[11px] text-slate-600">
                                Variance:{" "}
                                <span className={cx("font-semibold", ndMismatch ? "text-rose-700" : "text-emerald-700")}>
                                    {ndFinal - ndInit}
                                </span>
                            </div>
                        </div>

                        {/* Instruments summary */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-[12px] font-semibold text-slate-800">Instruments (Summary)</div>
                                <span
                                    className={cx(
                                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                        itemsEnabled
                                            ? instMismatch
                                                ? "bg-rose-50 text-rose-700"
                                                : "bg-emerald-50 text-emerald-700"
                                            : "bg-amber-50 text-amber-700"
                                    )}
                                >
                                    {itemsEnabled ? (instMismatch ? `${totals.mismatchCount} mismatch` : "OK") : "Lines API not enabled"}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1">
                                <NumField
                                    field="instruments_initial"
                                    label={itemsEnabled ? "Initial (Auto from lines)" : "Initial"}
                                    disabled={itemsEnabled}
                                    valueOverride={itemsEnabled ? totals.initial : undefined}
                                />
                                <NumField
                                    field="instruments_final"
                                    label={itemsEnabled ? "Final (Auto from lines)" : "Final"}
                                    disabled={itemsEnabled}
                                    valueOverride={itemsEnabled ? totals.final : undefined}
                                />
                            </div>

                            {itemsEnabled && (
                                <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Initial Total</span>
                                        <span className="font-semibold">{totals.initial}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Added Total</span>
                                        <span className="font-semibold">{totals.added}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Expected Final</span>
                                        <span className="font-semibold">{totals.expected}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Final Total</span>
                                        <span className="font-semibold">{totals.final}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Variance</span>
                                        <span className={cx("font-semibold", totals.variance === 0 ? "text-emerald-700" : "text-rose-700")}>
                                            {totals.variance}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* EXTREME: INSTRUMENT LINES */}
                    <div className="rounded-2xl border border-slate-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                            <div className="flex flex-col">
                                <span className="text-[12px] font-semibold text-slate-800">
                                    Instrument-wise Count Lines
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    Expected = Initial + Added · Variance = Final − Expected
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {itemsEnabled && canEdit && (
                                    <button
                                        type="button"
                                        onClick={openAdd}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add instrument
                                    </button>
                                )}
                            </div>
                        </div>

                        {!itemsEnabled ? (
                            <div className="px-3 py-3 text-[12px] text-amber-800">
                                Detailed instrument lines are not enabled on backend yet.
                                Once you add `/counts/items` APIs, this section will work automatically.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-[980px] w-full text-[12px]">
                                    <thead className="bg-slate-50">
                                        <tr className="text-left text-slate-600">
                                            <th className="px-3 py-2 font-semibold">Instrument</th>
                                            <th className="px-3 py-2 font-semibold">UOM</th>
                                            <th className="px-3 py-2 font-semibold">Initial</th>
                                            <th className="px-3 py-2 font-semibold">Added</th>
                                            <th className="px-3 py-2 font-semibold">Expected</th>
                                            <th className="px-3 py-2 font-semibold">Final</th>
                                            <th className="px-3 py-2 font-semibold">Variance</th>
                                            <th className="px-3 py-2 font-semibold">Remarks</th>
                                            <th className="px-3 py-2 font-semibold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.length === 0 ? (
                                            <tr>
                                                <td className="px-3 py-4 text-slate-500" colSpan={9}>
                                                    No instruments added. Click{" "}
                                                    <span className="font-semibold">Add instrument</span>{" "}
                                                    to start.
                                                </td>
                                            </tr>
                                        ) : (
                                            lines.map((x, idx) => {
                                                const i = toIntOrZero(x.initial_qty)
                                                const a = toIntOrZero(x.added_qty)
                                                const f = toIntOrZero(x.final_qty)
                                                const exp = i + a
                                                const variance = f - exp
                                                const bad = variance !== 0

                                                return (
                                                    <tr key={x.instrument_id ?? idx} className="border-t border-slate-100">
                                                        <td className="px-3 py-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-slate-900">
                                                                    {x.instrument_name}
                                                                </span>
                                                                <span className="text-[11px] text-slate-500">
                                                                    {x.instrument_code ? `Code: ${x.instrument_code}` : "—"}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td className="px-3 py-2 text-slate-700">{x.uom || "Nos"}</td>

                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="number"
                                                                className="h-8 w-24 rounded-xl border border-slate-300 bg-white px-2 outline-none focus:border-slate-500 disabled:opacity-60"
                                                                disabled={!canEdit}
                                                                value={x.initial_qty ?? 0}
                                                                onChange={(e) => updateLine(idx, { initial_qty: e.target.value })}
                                                            />
                                                        </td>

                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="number"
                                                                className="h-8 w-24 rounded-xl border border-slate-300 bg-white px-2 outline-none focus:border-slate-500 disabled:opacity-60"
                                                                disabled={!canEdit}
                                                                value={x.added_qty ?? 0}
                                                                onChange={(e) => updateLine(idx, { added_qty: e.target.value })}
                                                            />
                                                        </td>

                                                        <td className="px-3 py-2">
                                                            <span className="inline-flex h-8 w-24 items-center rounded-xl bg-slate-50 px-2 font-semibold text-slate-800">
                                                                {exp}
                                                            </span>
                                                        </td>

                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="number"
                                                                className={cx(
                                                                    "h-8 w-24 rounded-xl border px-2 outline-none focus:border-slate-500 disabled:opacity-60",
                                                                    bad ? "border-rose-300 bg-rose-50" : "border-slate-300 bg-white"
                                                                )}
                                                                disabled={!canEdit}
                                                                value={x.final_qty ?? 0}
                                                                onChange={(e) => updateLine(idx, { final_qty: e.target.value })}
                                                            />
                                                        </td>

                                                        <td className="px-3 py-2">
                                                            <span
                                                                className={cx(
                                                                    "inline-flex h-8 w-24 items-center justify-center rounded-xl px-2 font-semibold",
                                                                    bad ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                                                                )}
                                                            >
                                                                {variance}
                                                            </span>
                                                        </td>

                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="text"
                                                                className="h-8 w-[260px] rounded-xl border border-slate-300 bg-white px-2 outline-none focus:border-slate-500 disabled:opacity-60"
                                                                disabled={!canEdit}
                                                                value={x.remarks || ""}
                                                                onChange={(e) => updateLine(idx, { remarks: e.target.value })}
                                                                placeholder="e.g., replaced / re-checked / re-sterilized..."
                                                            />
                                                        </td>

                                                        <td className="px-3 py-2 text-right">
                                                            {canEdit && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeLine(x)}
                                                                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-rose-600" />
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* DISCREPANCY + ACTIONS (warnings only) */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[12px] font-semibold text-slate-800">
                                Discrepancy & Corrective Actions
                            </div>
                            <span
                                className={cx(
                                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    overallDiscrepancy ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                                )}
                            >
                                {overallDiscrepancy ? "DISCREPANCY" : "ALL MATCH"}
                            </span>
                        </div>

                        {itemsEnabled && totals.mismatchCount > 0 && (
                            <div className="mb-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                                <div className="font-semibold">Mismatch instruments:</div>
                                <ul className="mt-1 list-disc pl-5">
                                    {totals.mismatchLines.slice(0, 10).map((m) => {
                                        const i = toIntOrZero(m.initial_qty)
                                        const a = toIntOrZero(m.added_qty)
                                        const f = toIntOrZero(m.final_qty)
                                        const exp = i + a
                                        const varr = f - exp
                                        return (
                                            <li key={m.instrument_id}>
                                                {m.instrument_name} — Expected {exp}, Final {f} (Var {varr})
                                            </li>
                                        )
                                    })}
                                </ul>
                                {totals.mismatchCount > 10 && (
                                    <div className="mt-1 text-[11px] text-rose-700">
                                        +{totals.mismatchCount - 10} more…
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-slate-700">
                                Discrepancy (if any)
                            </span>
                            <textarea
                                rows={2}
                                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                                value={form.discrepancy_text}
                                disabled={!canEdit}
                                onChange={(e) => handleChange("discrepancy_text", e.target.value)}
                                placeholder="Describe mismatch and reconciliation steps…"
                            />
                        </div>

                        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
                            <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                                checked={!!form.xray_done}
                                disabled={!canEdit}
                                onChange={(e) => handleChange("xray_done", e.target.checked)}
                            />
                            <span>X-ray done for suspected retained item (if indicated)</span>
                        </label>

                        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="flex flex-col gap-1">
                                <span className="text-[11px] font-semibold text-slate-700">
                                    Resolved by
                                </span>
                                <input
                                    type="text"
                                    className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    value={form.resolved_by}
                                    disabled={!canEdit}
                                    onChange={(e) => handleChange("resolved_by", e.target.value)}
                                    placeholder="Surgeon / Scrub nurse / Circulating nurse…"
                                />
                            </label>

                            <label className="flex flex-col gap-1">
                                <span className="text-[11px] font-semibold text-slate-700">
                                    Notes / corrective action
                                </span>
                                <textarea
                                    rows={2}
                                    className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    value={form.notes}
                                    disabled={!canEdit}
                                    onChange={(e) => handleChange("notes", e.target.value)}
                                    placeholder="Actions taken, recount method, verification…"
                                />
                            </label>
                        </div>
                    </div>
                </>
            )}

            {/* ADD MODAL */}
            <AnimatePresence>
                {addOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3"
                        onMouseDown={() => setAddOpen(false)}
                    >
                        <motion.div
                            initial={{ y: 12, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 12, opacity: 0 }}
                            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                                <div className="text-[13px] font-semibold text-slate-900">
                                    Add Instrument from Master
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAddOpen(false)}
                                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="px-4 py-3">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <input
                                        className="h-9 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-[12px] outline-none focus:border-slate-500"
                                        value={masterQuery}
                                        onChange={(e) => setMasterQuery(e.target.value)}
                                        placeholder="Search by code or name…"
                                    />
                                </div>

                                {mastersLoading ? (
                                    <div className="mt-3 space-y-2">
                                        <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                                        <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                                        <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                                    </div>
                                ) : (
                                    <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-slate-200">
                                        {filteredMasters.length === 0 ? (
                                            <div className="px-3 py-3 text-[12px] text-slate-500">
                                                No matching instruments.
                                            </div>
                                        ) : (
                                            filteredMasters.map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => addInstrument(m)}
                                                    className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-[12px] font-semibold text-slate-900">
                                                            {m.name}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">
                                                            {m.code ? `Code: ${m.code}` : "—"} · UOM: {m.uom || "Nos"} · Available:{" "}
                                                            {m.available_qty ?? 0}
                                                        </span>
                                                    </div>
                                                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[12px] font-semibold text-white">
                                                        Add
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </form>
    )
}

export default CountsTab
