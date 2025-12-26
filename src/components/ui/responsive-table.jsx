// FILE: src/components/ui/responsive-table.jsx
import React from "react"

const cn = (...c) => c.filter(Boolean).join(" ")

export default function ResponsiveTable({
    title,
    subtitle,
    columns = [], // [{ key, header, className, render?: (row)=>node, mobileLabel?: string }]
    rows = [],
    rowKey = (r, i) => r?.id ?? i,
    emptyText = "No records found.",
    rightSlot = null, // filters/actions area
}) {
    return (
        <div className="space-y-3">
            {(title || rightSlot) && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        {title && (
                            <div className="text-sm font-semibold text-slate-900">{title}</div>
                        )}
                        {subtitle && (
                            <div className="text-[12px] text-slate-500">{subtitle}</div>
                        )}
                    </div>
                    {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
                </div>
            )}

            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/60 md:block">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[12px] text-slate-500">
                        <tr>
                            {columns.map((c) => (
                                <th
                                    key={c.key}
                                    className={cn("px-4 py-3 text-left font-semibold", c.className)}
                                >
                                    {c.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="px-4 py-10 text-center text-[12px] text-slate-500"
                                >
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r, i) => (
                                <tr key={rowKey(r, i)} className="border-t border-slate-100">
                                    {columns.map((c) => (
                                        <td key={c.key} className="px-4 py-3 align-top text-slate-800">
                                            {c.render ? c.render(r) : r?.[c.key] ?? "—"}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid gap-3 md:hidden">
                {rows.length === 0 ? (
                    <div className="rounded-3xl bg-white px-4 py-10 text-center text-[12px] text-slate-500 shadow-sm ring-1 ring-slate-200/60">
                        {emptyText}
                    </div>
                ) : (
                    rows.map((r, i) => (
                        <div
                            key={rowKey(r, i)}
                            className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60"
                        >
                            <div className="grid gap-3">
                                {columns.map((c) => (
                                    <div key={c.key} className="flex items-start justify-between gap-3">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            {c.mobileLabel || c.header}
                                        </div>
                                        <div className="text-right text-[13px] text-slate-800">
                                            {c.render ? c.render(r) : r?.[c.key] ?? "—"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
