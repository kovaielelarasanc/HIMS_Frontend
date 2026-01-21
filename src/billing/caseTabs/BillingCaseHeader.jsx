// FILE: src/billing/components/BillingCaseHeader.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge, Button, StatusBadge, cn } from "../_ui"
import {
    ArrowLeft,
    RefreshCcw,
    FilePlus2,
    ChevronDown,
    ChevronUp,
    Copy,
    UserRound,
    IdCard,
    Phone,
    Layers,
    Shield,
    Hash,
} from "lucide-react"

function safeText(v) {
    const s = String(v ?? "").trim()
    return s ? s : "—"
}

function InfoChip({ icon: Icon, label, value, onCopy }) {
    return (
        <div className="group inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50">
                <Icon className="h-4 w-4 text-slate-700" />
            </div>

            <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500">{label}</div>
                <div className="truncate text-sm font-extrabold text-slate-900">{safeText(value)}</div>
            </div>

            {!!onCopy && value && value !== "—" && (
                <button
                    className="ml-1 rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    onClick={onCopy}
                    title="Copy"
                    type="button"
                >
                    <Copy className="h-4 w-4" />
                </button>
            )}
        </div>
    )
}

export default function BillingCaseHeader({
    caseRow,
    loading,
    onBack,
    onRefresh,
    onAddItem,
    printNode,
}) {
    // desktop: expanded by default, mobile: collapsed
    const [expanded, setExpanded] = useState(false)

    useEffect(() => {
        try {
            if (window.matchMedia("(min-width: 768px)").matches) setExpanded(true)
        } catch {
            // ignore
        }
    }, [])

    const display = useMemo(() => {
        const caseNo = caseRow?.case_number || caseRow?.case_no || caseRow?.display_number || ""
        const encType = caseRow?.encounter_type || "—"

        // prefer a non-raw display field if your API provides it
        const encNo =
            caseRow?.encounter_number ||
            caseRow?.encounter_no ||
            caseRow?.encounter_display ||
            caseRow?.encounter_id ||
            "—"

        const titleLeft = caseNo ? caseNo : "Billing Case"
        const titleRight = `${encType} / ${safeText(encNo)}`

        return {
            caseNo: caseNo ? caseNo : "—",
            encType,
            encNo: safeText(encNo),
            title: titleLeft,
            sub: titleRight,
            patient: safeText(caseRow?.patient_name),
            uhid: safeText(caseRow?.uhid),
            phone: safeText(caseRow?.phone),
            payerMode: safeText(caseRow?.payer_mode || "SELF"),
            status: caseRow?.status || "",
        }
    }, [caseRow])

    const copy = async (label, value) => {
        const v = String(value ?? "").trim()
        if (!v || v === "—") return
        try {
            await navigator.clipboard.writeText(v)
            toast.success(`${label} copied`)
        } catch {
            toast.error("Copy failed")
        }
    }

    return (
        <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
            {/* Row 1: Back + Titles + Actions */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <Button variant="outline" onClick={onBack} className="shrink-0">
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>

                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-lg font-black text-slate-900 md:text-xl">
                                {display.title}
                            </div>
                            <StatusBadge status={display.status} />
                            <Badge tone="slate" className="whitespace-nowrap">
                                {display.payerMode}
                            </Badge>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <Hash className="h-3.5 w-3.5" /> {display.sub}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3.5 w-3.5" /> {display.patient}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions: icon-only on mobile, full buttons on sm+ */}
                <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>

                    {printNode}

                    <Button onClick={onAddItem} className="gap-2">
                        <FilePlus2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Add Item Line</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                </div>
            </div>

            {/* Row 2: Chips + Expand */}
            <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-600">
                    <Layers className="h-4 w-4" />
                    <span className="truncate">Case details</span>
                </div>

                <button
                    type="button"
                    className="md:hidden inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                    onClick={() => setExpanded((s) => !s)}
                >
                    {expanded ? (
                        <>
                            <ChevronUp className="h-4 w-4" /> Hide
                        </>
                    ) : (
                        <>
                            <ChevronDown className="h-4 w-4" /> Show
                        </>
                    )}
                </button>
            </div>

            {/* Chips area */}
            <div
                className={cn(
                    "mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    expanded ? "block" : "hidden md:block"
                )}
            >
                <div className="flex w-max items-stretch gap-2">
                    <InfoChip
                        icon={UserRound}
                        label="Patient"
                        value={display.patient}
                    />
                    <InfoChip
                        icon={IdCard}
                        label="UHID"
                        value={display.uhid}
                        onCopy={() => copy("UHID", display.uhid)}
                    />
                    <InfoChip
                        icon={Phone}
                        label="Phone"
                        value={display.phone}
                        onCopy={() => copy("Phone", display.phone)}
                    />
                    <InfoChip
                        icon={Shield}
                        label="Payer Mode"
                        value={display.payerMode}
                    />
                    <InfoChip
                        icon={Hash}
                        label="Encounter"
                        value={`${display.encType} / ${display.encNo}`}
                    />
                </div>
            </div>
        </div>
    )
}
