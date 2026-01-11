// FILE: src/components/quickorders/RisScreen.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { Radio, Search, Loader2, Trash2, AlertTriangle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

import { listRisTests, createRisOrder } from "@/api/ris"
import { cx, StatusChip, PremiumButton, fmtIST, extractApiError } from "./_shared"

export default function RisScreen({
    patient,
    ctx,
    contextId,
    canUseContext,
    onBack,
    loadSummary,
    loadingSummary,
    summaryRis = [],
    openDetails,
}) {
    const [risQuery, setRisQuery] = useState("")
    const [risOptions, setRisOptions] = useState([])
    const [risSearching, setRisSearching] = useState(false)
    const [showRisDropdown, setShowRisDropdown] = useState(false)
    const risDropRef = useRef(null)

    const [risSelectedTests, setRisSelectedTests] = useState([]) // [{id, code, name, modality}]
    const [risPriority, setRisPriority] = useState("routine")
    const [risNote, setRisNote] = useState("")
    const [risSubmitting, setRisSubmitting] = useState(false)

    const risTestIds = useMemo(() => risSelectedTests.map((t) => t.id), [risSelectedTests])

    // Close dropdown on outside click / ESC
    useEffect(() => {
        const onDown = (e) => {
            const t = e.target
            if (risDropRef.current && !risDropRef.current.contains(t)) setShowRisDropdown(false)
        }
        const onKey = (e) => {
            if (e.key === "Escape") setShowRisDropdown(false)
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [])

    // Debounced RIS master search
    useEffect(() => {
        if (!risQuery || risQuery.trim().length < 2) {
            setRisOptions([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            try {
                setRisSearching(true)
                const { data } = await listRisTests({ q: risQuery.trim() })
                if (cancelled) return
                const items = Array.isArray(data) ? data : data?.items || []
                setRisOptions(items)
                setShowRisDropdown(true)
            } catch (err) {
                console.error(err)
                toast.error("Failed to fetch radiology tests.")
            } finally {
                if (!cancelled) setRisSearching(false)
            }
        }, 180)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [risQuery])

    const handleSelectRisTest = (t) => {
        if (!t?.id) return
        setRisSelectedTests((prev) => {
            if (prev.some((x) => x.id === t.id)) return prev
            return [
                ...prev,
                {
                    id: t.id,
                    code: t.code || "",
                    name: t.name || t.test_name || "",
                    modality: t.modality || t.modality_code || "",
                },
            ]
        })
        setRisQuery("")
        setShowRisDropdown(false)
    }

    const handleRemoveRisTest = (id) => setRisSelectedTests((prev) => prev.filter((t) => t.id !== id))

    const handleSubmitRis = async () => {
        if (!risTestIds.length) return toast.error("Add at least one radiology test.")
        if (!patient?.id) return toast.error("Patient missing for radiology order.")
        if (!ctx || !contextId) return toast.error("Missing context (OPD/IPD) for radiology order.")

        setRisSubmitting(true)
        try {
            await Promise.all(
                risTestIds.map((id) =>
                    createRisOrder({
                        patient_id: patient.id,
                        test_id: Number(id),
                        context_type: ctx,
                        context_id: contextId,
                        priority: risPriority,
                        note: risNote || null,
                    })
                )
            )
            toast.success("Radiology order(s) created")
            setRisSelectedTests([])
            setRisNote("")
            setRisQuery("")
            loadSummary?.()
        } catch (err) {
            console.error(err)
            toast.error(extractApiError(err, "Failed to create radiology order(s)"))
        } finally {
            setRisSubmitting(false)
        }
    }

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
                        <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                            <Radio className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-900">Radiology Orders</div>
                            <div className="text-[11px] text-slate-500">Search tests → priority → place order.</div>
                        </div>
                    </div>
                </div>
                <StatusChip tone="ris">{risSelectedTests.length} selected</StatusChip>
            </div>

            {!canUseContext && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>Missing patient/context. Ensure patient + contextType(OPD/IPD) + contextId.</div>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                {/* Left: Create */}
                <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                            <Radio className="h-4 w-4 text-indigo-600" />
                            Create Radiology Order
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                        <div ref={risDropRef} className="space-y-1.5 relative">
                            <label className="text-xs font-medium text-slate-600">Radiology test (RIS Masters)</label>
                            <div className="relative">
                                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                <Input
                                    value={risQuery}
                                    onChange={(e) => {
                                        setRisQuery(e.target.value)
                                        setShowRisDropdown(true)
                                    }}
                                    placeholder="Search X-Ray / CT / MRI / USG…"
                                    className="h-10 text-xs pl-7 rounded-2xl"
                                />
                            </div>

                            {showRisDropdown && (risOptions.length > 0 || risSearching) && (
                                <div className="absolute z-30 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl max-h-56 overflow-auto text-xs">
                                    {risSearching && (
                                        <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Searching…
                                        </div>
                                    )}
                                    {!risSearching && !risOptions.length && <div className="px-3 py-2 text-slate-500">No tests found.</div>}
                                    {!risSearching &&
                                        risOptions.map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => handleSelectRisTest(t)}
                                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                            >
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="font-medium text-slate-900 truncate">{t.name || t.test_name}</span>
                                                    <span className="text-[10px] text-slate-500 shrink-0">{t.modality || t.modality_code || "—"}</span>
                                                </div>
                                                <span className="text-[11px] text-slate-500 truncate">{t.code || "—"}</span>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Priority */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Priority</label>
                            <div className="flex flex-wrap gap-2">
                                {["routine", "urgent", "stat"].map((p) => {
                                    const active = risPriority === p
                                    return (
                                        <PremiumButton
                                            key={p}
                                            type="button"
                                            tone="ris"
                                            variant={active ? "solid" : "outline"}
                                            className="h-9 px-3 text-[11px] rounded-xl flex-1 min-w-[92px]"
                                            onClick={() => setRisPriority(p)}
                                        >
                                            {p === "routine" ? "Routine" : p === "urgent" ? "Urgent" : "STAT"}
                                        </PremiumButton>
                                    )
                                })}
                            </div>
                        </div>

                        {risSelectedTests.length > 0 && (
                            <ScrollArea className="max-h-44 rounded-2xl border border-slate-200 bg-slate-50/60 p-2">
                                <ul className="space-y-1.5 text-xs">
                                    {risSelectedTests.map((t) => (
                                        <li
                                            key={t.id}
                                            className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 border border-slate-100"
                                        >
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-semibold text-slate-900 truncate">{t.name || "Radiology test"}</span>
                                                <span className="text-[11px] text-slate-500 truncate">
                                                    {t.modality || "RIS"} • Code: {t.code || "—"}
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="h-9 w-9 text-slate-400 hover:text-rose-600 rounded-2xl"
                                                onClick={() => handleRemoveRisTest(t.id)}
                                                title="Remove"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </ScrollArea>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Note (optional)</label>
                            <Textarea
                                rows={2}
                                value={risNote}
                                onChange={(e) => setRisNote(e.target.value)}
                                placeholder="Side / position / contrast / clinical history etc."
                                className="resize-none text-xs rounded-2xl"
                            />
                        </div>

                        <div className="flex justify-end">
                            <PremiumButton
                                type="button"
                                tone="ris"
                                variant="solid"
                                disabled={risSubmitting || !canUseContext}
                                onClick={handleSubmitRis}
                                className="h-10 px-5 text-xs"
                            >
                                {risSubmitting ? "Placing Radiology Order…" : "Place Radiology Order"}
                            </PremiumButton>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Recent */}
                <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Radio className="h-4 w-4 text-indigo-600" />
                            <CardTitle className="text-xs font-semibold">Recent Radiology Orders</CardTitle>
                        </div>
                        <StatusChip tone="ris">{summaryRis?.length || 0}</StatusChip>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="space-y-2 max-h-80 overflow-auto text-[11px]">
                            {!summaryRis?.length && !loadingSummary && <div className="text-slate-500 text-[12px]">No radiology orders yet.</div>}
                            {summaryRis?.map((o) => (
                                <button
                                    key={o.id}
                                    type="button"
                                    onClick={() => openDetails?.("ris", o)}
                                    className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                >
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-slate-900 truncate">
                                            {o.order_no || `RIS-${String(o.id).padStart(6, "0")}`}
                                        </span>
                                        <span className="text-[10px] text-slate-500 truncate">{fmtIST(o.created_at || o.order_datetime)}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-600 capitalize shrink-0">{o.status || "ordered"}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
