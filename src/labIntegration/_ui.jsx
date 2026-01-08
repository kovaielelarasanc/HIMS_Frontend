// src/labIntegration/_ui.jsx
import { useEffect } from "react"
export const cn = (...a) => a.filter(Boolean).join(" ")

export function Card({ className, children }) {
    return (
        <div className={cn("rounded-3xl border border-slate-200/70 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.12)]", className)}>
            {children}
        </div>
    )
}
export function CardHeader({ className, title, subtitle, right }) {
    return (
        <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
            <div className="min-w-0">
                <div className="text-[15px] font-semibold text-slate-900">{title}</div>
                {subtitle ? <div className="mt-1 text-[12.5px] text-slate-600">{subtitle}</div> : null}
            </div>
            {right ? <div className="shrink-0">{right}</div> : null}
        </div>
    )
}
export function CardBody({ className, children }) {
    return <div className={cn("px-5 pb-5 pt-4", className)}>{children}</div>
}
export function Button({ className, variant = "primary", size = "md", ...props }) {
    const base = "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
    const sizes = { sm: "h-9 px-3 text-[13px]", md: "h-10 px-4 text-[13.5px]", lg: "h-11 px-5 text-[14px]" }
    const variants = {
        primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-[0_10px_30px_rgba(15,23,42,0.18)]",
        secondary: "bg-white text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-[0_8px_20px_rgba(15,23,42,0.08)]",
        ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
        danger: "bg-red-600 text-white hover:bg-red-700",
    }
    return <button className={cn(base, sizes[size], variants[variant], className)} {...props} />
}
export function Input({ className, ...props }) {
    return (
        <input
            className={cn("h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100", className)}
            {...props}
        />
    )
}
export function Select({ className, children, ...props }) {
    return (
        <select
            className={cn("h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[13.5px] text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100", className)}
            {...props}
        >
            {children}
        </select>
    )
}
export function Textarea({ className, ...props }) {
    return (
        <textarea
            className={cn("min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100", className)}
            {...props}
        />
    )
}
export function Label({ children }) {
    return <div className="mb-1.5 text-[12px] font-medium text-slate-700">{children}</div>
}
export function Badge({ children, tone = "neutral" }) {
    const tones = {
        neutral: "bg-slate-100 text-slate-700 border-slate-200",
        ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
        warn: "bg-amber-50 text-amber-700 border-amber-200",
        bad: "bg-red-50 text-red-700 border-red-200",
        info: "bg-sky-50 text-sky-700 border-sky-200",
    }
    return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[12px]", tones[tone])}>{children}</span>
}
export function Divider() {
    return <div className="my-4 h-px w-full bg-slate-200" />
}
export function EmptyState({ title, subtitle, action }) {
    return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <div className="text-[14px] font-semibold text-slate-900">{title}</div>
            {subtitle ? <div className="mt-1 text-[12.5px] text-slate-600">{subtitle}</div> : null}
            {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
        </div>
    )
}
export function Table({ columns, rows, rowKey }) {
    return (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                    <thead className="bg-slate-50">
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} className="px-4 py-3 text-left text-[12px] font-semibold text-slate-700">
                                    {c.title}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, idx) => (
                            <tr key={rowKey ? rowKey(r) : idx} className={cn("border-t border-slate-200", idx % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                                {columns.map((c) => (
                                    <td key={c.key} className="px-4 py-3 align-top text-[13px] text-slate-800">
                                        {typeof c.render === "function" ? c.render(r) : r?.[c.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
export function Modal({ open, onClose, title, children, footer }) {
    useEffect(() => {
        function onEsc(e) { if (e.key === "Escape") onClose?.() }
        if (open) window.addEventListener("keydown", onEsc)
        return () => window.removeEventListener("keydown", onEsc)
    }, [open, onClose])
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.25)]">
                    <div className="flex items-start justify-between gap-4 px-5 pt-5">
                        <div className="text-[15px] font-semibold text-slate-900">{title}</div>
                        <button onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-200">Close</button>
                    </div>
                    <div className="px-5 py-4">{children}</div>
                    {footer ? <div className="flex items-center justify-end gap-2 px-5 pb-5">{footer}</div> : null}
                </div>
            </div>
        </div>
    )
}
export function Drawer({ open, onClose, title, children, footer }) {
    useEffect(() => {
        function onEsc(e) { if (e.key === "Escape") onClose?.() }
        if (open) window.addEventListener("keydown", onEsc)
        return () => window.removeEventListener("keydown", onEsc)
    }, [open, onClose])
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[70]">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="absolute inset-y-0 right-0 w-full max-w-3xl border-l border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.25)]">
                <div className="flex items-start justify-between gap-4 px-5 pt-5">
                    <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-slate-900">{title}</div>
                        <div className="mt-1 text-[12.5px] text-slate-500">Press Esc to close</div>
                    </div>
                    <button onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-200">Close</button>
                </div>
                <div className="h-[calc(100vh-140px)] overflow-auto px-5 py-4">{children}</div>
                {footer ? <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">{footer}</div> : null}
            </div>
        </div>
    )
}
export function SegmentedTabs({ value, onChange, tabs }) {
    return (
        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {tabs.map((t) => {
                const active = value === t.value
                return (
                    <button
                        key={t.value}
                        onClick={() => onChange(t.value)}
                        className={cn("h-9 rounded-xl px-3 text-[13px] font-medium transition", active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/70")}
                    >
                        {t.label}
                    </button>
                )
            })}
        </div>
    )
}
export function StatTile({ label, value, hint, tone = "neutral" }) {
    const tones = {
        neutral: "border-slate-200 bg-white",
        ok: "border-emerald-200 bg-emerald-50",
        warn: "border-amber-200 bg-amber-50",
        bad: "border-red-200 bg-red-50",
        info: "border-sky-200 bg-sky-50",
    }
    return (
        <div className={cn("rounded-3xl border p-4", tones[tone])}>
            <div className="text-[12px] text-slate-600">{label}</div>
            <div className="mt-1 text-[22px] font-semibold text-slate-900">{value}</div>
            {hint ? <div className="mt-1 text-[12px] text-slate-500">{hint}</div> : null}
        </div>
    )
}
