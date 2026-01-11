// FILE: src/components/quickorders/LabScreen.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { FlaskConical, Search, Loader2, Trash2, AlertTriangle, Eye, Download, Printer, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

import { listLabTests, createLisOrder } from "@/api/lab"
import { cx, StatusChip, PremiumButton, fmtIST, extractApiError } from "./_shared"

export default function LabScreen({
    patient,
    ctx,
    contextId,
    canUseContext,
    onBack,
    loadSummary,
    loadingSummary,
    summaryLab = [],
    openDetails,
    labPdfActions,
}) {
    const [labQuery, setLabQuery] = useState("")
    const [labOptions, setLabOptions] = useState([])
    const [labSearching, setLabSearching] = useState(false)
    const [showLabDropdown, setShowLabDropdown] = useState(false)
    const labDropRef = useRef(null)

    const [labSelectedTests, setLabSelectedTests] = useState([]) // [{id, code, name}]
    const [labPriority, setLabPriority] = useState("routine")
    const [labNote, setLabNote] = useState("")
    const [labSubmitting, setLabSubmitting] = useState(false)

    const labTestIds = useMemo(() => labSelectedTests.map((t) => t.id), [labSelectedTests])

    // Close dropdown on outside click / ESC
    useEffect(() => {
        const onDown = (e) => {
            const t = e.target
            if (labDropRef.current && !labDropRef.current.contains(t)) setShowLabDropdown(false)
        }
        const onKey = (e) => {
            if (e.key === "Escape") setShowLabDropdown(false)
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [])

    // Debounced master search
    useEffect(() => {
        if (!labQuery || labQuery.trim().length < 2) {
            setLabOptions([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            try {
                setLabSearching(true)
                const { data } = await listLabTests({ q: labQuery.trim() })
                if (cancelled) return
                const items = Array.isArray(data) ? data : data?.items || []
                setLabOptions(items)
                setShowLabDropdown(true)
            } catch (err) {
                console.error(err)
                toast.error("Failed to fetch lab tests.")
            } finally {
                if (!cancelled) setLabSearching(false)
            }
        }, 180)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [labQuery])

    const handleSelectLabTest = (t) => {
        if (!t?.id) return
        setLabSelectedTests((prev) => {
            if (prev.some((x) => x.id === t.id)) return prev
            return [
                ...prev,
                { id: t.id, code: t.code || t.short_code || "", name: t.name || t.test_name || "" },
            ]
        })
        setLabQuery("")
        setShowLabDropdown(false)
    }

    const handleRemoveLabTest = (id) => setLabSelectedTests((prev) => prev.filter((t) => t.id !== id))

    const handleSubmitLab = async () => {
        if (!labTestIds.length) return toast.error("Add at least one lab test.")
        if (!patient?.id) return toast.error("Patient missing for lab order.")
        if (!ctx || !contextId) return toast.error("Missing context (OPD/IPD) for lab order.")

        setLabSubmitting(true)
        try {
            await createLisOrder({
                patient_id: patient.id,
                context_type: ctx,
                context_id: contextId,
                priority: labPriority,
                test_ids: labTestIds,
                note: labNote || null,
            })
            toast.success("Lab order created")
            setLabSelectedTests([])
            setLabNote("")
            setLabQuery("")
            loadSummary?.()
        } catch (err) {
            console.error(err)
            toast.error(extractApiError(err, "Failed to create lab order"))
        } finally {
            setLabSubmitting(false)
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
                        <div className="h-10 w-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center">
                            <FlaskConical className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-900">Lab Orders</div>
                            <div className="text-[11px] text-slate-500">Search tests → set priority → place order.</div>
                        </div>
                    </div>
                </div>

                <StatusChip tone="lab">{labSelectedTests.length} selected</StatusChip>
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
                            <FlaskConical className="h-4 w-4 text-sky-600" />
                            Create Lab Order
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
                            {/* Search */}
                            <div ref={labDropRef} className="space-y-1.5 relative">
                                <label className="text-xs font-medium text-slate-600">Lab test (Masters)</label>
                                <div className="relative">
                                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                    <Input
                                        value={labQuery}
                                        onChange={(e) => {
                                            setLabQuery(e.target.value)
                                            setShowLabDropdown(true)
                                        }}
                                        placeholder="Search code / name…"
                                        className="h-10 text-xs pl-7 rounded-2xl"
                                    />
                                </div>

                                {showLabDropdown && (labOptions.length > 0 || labSearching) && (
                                    <div className="absolute z-30 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl max-h-56 overflow-auto text-xs">
                                        {labSearching && (
                                            <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Searching…
                                            </div>
                                        )}
                                        {!labSearching && !labOptions.length && <div className="px-3 py-2 text-slate-500">No tests found.</div>}
                                        {!labSearching &&
                                            labOptions.map((t) => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => handleSelectLabTest(t)}
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                >
                                                    <span className="font-medium text-slate-900">{t.name || t.test_name}</span>
                                                    <span className="text-[11px] text-slate-500">{t.code || t.short_code || "—"}</span>
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
                                        const active = labPriority === p
                                        return (
                                            <PremiumButton
                                                key={p}
                                                type="button"
                                                tone="lab"
                                                variant={active ? "solid" : "outline"}
                                                onClick={() => setLabPriority(p)}
                                                className="h-9 px-3 text-[11px] rounded-xl flex-1 min-w-[92px]"
                                            >
                                                {p === "routine" ? "Routine" : p === "urgent" ? "Urgent" : "STAT"}
                                            </PremiumButton>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {labSelectedTests.length > 0 && (
                            <ScrollArea className="max-h-44 rounded-2xl border border-slate-200 bg-slate-50/60 p-2">
                                <ul className="space-y-1.5 text-xs">
                                    {labSelectedTests.map((t) => (
                                        <li
                                            key={t.id}
                                            className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 border border-slate-100"
                                        >
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-semibold text-slate-900 truncate">{t.name || "Lab test"}</span>
                                                <span className="text-[11px] text-slate-500 truncate">Code: {t.code || "—"}</span>
                                            </div>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="h-9 w-9 text-slate-400 hover:text-rose-600 rounded-2xl"
                                                onClick={() => handleRemoveLabTest(t.id)}
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
                                value={labNote}
                                onChange={(e) => setLabNote(e.target.value)}
                                placeholder="Special instructions for sample collection / processing."
                                className="resize-none text-xs rounded-2xl"
                            />
                        </div>

                        <div className="flex items-center justify-end">
                            <PremiumButton
                                type="button"
                                tone="lab"
                                variant="solid"
                                disabled={labSubmitting || !canUseContext}
                                onClick={handleSubmitLab}
                                className="h-10 px-5 text-xs"
                            >
                                {labSubmitting ? "Placing Lab Order…" : "Place Lab Order"}
                            </PremiumButton>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Recent */}
                <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-sky-600" />
                            <CardTitle className="text-xs font-semibold">Recent Lab Orders</CardTitle>
                        </div>
                        <StatusChip tone="lab">{summaryLab?.length || 0}</StatusChip>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="space-y-2 max-h-80 overflow-auto text-[11px]">
                            {!summaryLab?.length && !loadingSummary && <div className="text-slate-500 text-[12px]">No lab orders yet.</div>}
                            {summaryLab?.map((o) => (
                                <div key={o.id} className="flex items-stretch gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openDetails?.("lab", o)}
                                        className="flex-1 text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-semibold text-slate-900 truncate">
                                                {o.order_no || `LAB-${String(o.id).padStart(6, "0")}`}
                                            </span>
                                            <span className="text-[10px] text-slate-500 truncate">{fmtIST(o.created_at || o.order_datetime)}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-600 capitalize shrink-0">{o.status || "ordered"}</span>
                                    </button>

                                    <PremiumButton tone="lab" variant="outline" size="icon" className="h-10 w-10" title="View PDF" onClick={() => labPdfActions?.(o.id, "view")}>
                                        <Eye className="h-4 w-4" />
                                    </PremiumButton>
                                    <PremiumButton tone="lab" variant="outline" size="icon" className="h-10 w-10" title="Print PDF" onClick={() => labPdfActions?.(o.id, "print")}>
                                        <Printer className="h-4 w-4" />
                                    </PremiumButton>
                                    <PremiumButton tone="lab" variant="outline" size="icon" className="h-10 w-10" title="Download PDF" onClick={() => labPdfActions?.(o.id, "download")}>
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
