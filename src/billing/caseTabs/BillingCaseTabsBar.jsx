// FILE: src/billing/components/BillingCaseTabsBar.jsx
import { useMemo, useState } from "react"
import { cn } from "../_ui"
import { MoreHorizontal, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

function SegBtn({ active, onClick, icon: Icon, label, compact }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "relative inline-flex items-center gap-2 rounded-2xl px-3 py-2 font-extrabold transition",
                "focus:outline-none focus:ring-2 focus:ring-slate-300",
                compact ? "text-xs" : "text-sm",
                active ? "bg-slate-900 text-white shadow-sm" : "bg-transparent text-slate-700 hover:bg-slate-100"
            )}
        >
            {Icon ? <Icon className={cn("h-4 w-4", compact ? "" : "opacity-90")} /> : null}
            <span className="whitespace-nowrap">{label}</span>
        </button>
    )
}

function groupTabs(tabs) {
    const order = ["Case", "Billing", "Insurance", "Settings", "Other"]
    const map = new Map()
    for (const t of tabs) {
        const g = t.group || "Other"
        if (!map.has(g)) map.set(g, [])
        map.get(g).push(t)
    }
    return order.filter((k) => map.has(k)).map((k) => ({ group: k, items: map.get(k) }))
}

export default function BillingCaseTabsBar({ tabs, value, onChange }) {
    const [openMore, setOpenMore] = useState(false)

    const mobileKeys = useMemo(() => ["OVERVIEW", "INVOICES", "PAYMENTS", "ADVANCES"], [])
    const mdKeys = useMemo(() => ["OVERVIEW", "INVOICE_SUMMARY", "INVOICES", "PAYMENTS", "ADVANCES", "INSURANCE"], [])

    const byKey = useMemo(() => {
        const m = {}
        for (const t of tabs) m[t.key] = t
        return m
    }, [tabs])

    const mobileVisible = useMemo(() => mobileKeys.map((k) => byKey[k]).filter(Boolean), [mobileKeys, byKey])
    const mdVisible = useMemo(() => mdKeys.map((k) => byKey[k]).filter(Boolean), [mdKeys, byKey])

    const visibleKeysMobile = new Set(mobileVisible.map((t) => t.key))
    const visibleKeysMd = new Set(mdVisible.map((t) => t.key))

    const mdOverflow = useMemo(() => tabs.filter((t) => !visibleKeysMd.has(t.key)), [tabs, visibleKeysMd])

    const groupedAll = useMemo(() => groupTabs(tabs), [tabs])
    const activeTab = useMemo(() => tabs.find((t) => t.key === value), [tabs, value])

    return (
        <>
            <div className="sticky top-2 z-20 mb-3 bg-blue-800 rounded-full">
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-2 shadow-sm backdrop-blur">
                    {/* Mobile (keep scroll) */}
                    <div className="flex items-center gap-2 md:hidden">
                        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <div className="flex w-max items-center gap-1 rounded-2xl bg-slate-50 p-1">
                                {mobileVisible.map((t) => (
                                    <SegBtn
                                        key={t.key}
                                        active={value === t.key}
                                        onClick={() => onChange(t.key)}
                                        icon={t.icon}
                                        label={t.mobileLabel || t.shortLabel || t.label}
                                        compact
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setOpenMore(true)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                            More
                        </button>
                    </div>

                    {/* md+ (WRAP layout, no scroll) */}
                    <div className="hidden md:flex md:items-start md:gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-slate-50 p-1">
                                {(tabs.length ? (window?.matchMedia?.("(min-width: 1024px)")?.matches ? tabs : mdVisible) : mdVisible).map(
                                    (t) => (
                                        <SegBtn
                                            key={t.key}
                                            active={value === t.key}
                                            onClick={() => onChange(t.key)}
                                            icon={t.icon}
                                            label={t.shortLabel || t.label}
                                        />
                                    )
                                )}
                            </div>
                        </div>

                        {/* More on md only (lg+ shows all usually) */}
                        {!!mdOverflow.length && (
                            <button
                                type="button"
                                onClick={() => setOpenMore(true)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                                More
                            </button>
                        )}

                        <div className="hidden xl:flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600">
                            <span className="text-slate-400">Active</span>
                            <ChevronRight className="h-4 w-4 text-slate-300" />
                            <span className="text-slate-900">{activeTab?.label || "—"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* More dialog */}
            <Dialog open={openMore} onOpenChange={setOpenMore}>
                <DialogContent className="max-w-lg rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black text-slate-900">All Sections</DialogTitle>
                    </DialogHeader>

                    <div className="mt-2 space-y-4">
                        {groupedAll.map((g) => (
                            <div key={g.group} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs font-black uppercase tracking-wide text-slate-600">{g.group}</div>

                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {g.items.map((t) => {
                                        const Icon = t.icon
                                        const active = value === t.key
                                        return (
                                            <button
                                                key={t.key}
                                                type="button"
                                                onClick={() => {
                                                    onChange(t.key)
                                                    setOpenMore(false)
                                                }}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                                                    active ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "flex h-9 w-9 items-center justify-center rounded-2xl",
                                                        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                                                    )}
                                                >
                                                    {Icon ? <Icon className="h-4 w-4" /> : null}
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-black text-slate-900">{t.label}</div>
                                                    {t.hint ? <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">{t.hint}</div> : null}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
