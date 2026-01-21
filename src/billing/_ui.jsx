// FILE: src/billing/_ui.jsx
import { clsx } from "clsx"
import { toast } from "sonner"
import { Download, Printer } from "lucide-react"

// If you already have shadcn/ui components, you can switch these to imports.
// This file intentionally uses plain Tailwind so it runs even if some ui components are missing.

export function cn(...args) {
    return clsx(args)
}

export function money(n) {
    const v = Number(n ?? 0)
    if (Number.isNaN(v)) return "0.00"
    return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function Badge({ children, tone = "slate", className }) {
    const tones = {
        slate: "bg-slate-100 text-slate-700 border-slate-200",
        green: "bg-emerald-50 text-emerald-700 border-emerald-200",
        amber: "bg-amber-50 text-amber-800 border-amber-200",
        red: "bg-rose-50 text-rose-700 border-rose-200",
        blue: "bg-sky-50 text-sky-700 border-sky-200",
        violet: "bg-violet-50 text-violet-700 border-violet-200",
    }
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                tones[tone] || tones.slate,
                className
            )}
        >
            {children}
        </span>
    )
}

export function StatusBadge({ status }) {
    const s = String(status || "").toUpperCase()
    const tone =
        s === "POSTED"
            ? "green"
            : s === "APPROVED"
                ? "blue"
                : s === "DRAFT"
                    ? "slate"
                    : s === "VOID"
                        ? "red"
                        : s === "CANCELLED"
                            ? "red"
                            : s.includes("READY")
                                ? "amber"
                                : "slate"

    return <Badge tone={tone}>{s || "—"}</Badge>
}

export function Button({ children, variant = "default", size = "md", className, ...props }) {
    const variants = {
        default: "bg-rose-600 text-white hover:bg-slate-800",
        outline: "bg-[#121212] text-[#ffff] border border-slate-200 hover:bg-slate-50 hover:text-black",
        ghost: "bg-transparent text-slate-800 hover:bg-slate-100",
        danger: "bg-rose-600 text-white hover:bg-rose-700",
    }
    const sizes = {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-base",
    }
    return (
        <button
            className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
                variants[variant] || variants.default,
                sizes[size] || sizes.md,
                className
            )}
            {...props}
        >
            {children}
        </button>
    )
}

export function Input({ className, ...props }) {
    return (
        <input
            className={cn(
                "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
                className
            )}
            {...props}
        />
    )
}

export function Select({ className, children, ...props }) {
    return (
        <select
            className={cn(
                "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200",
                className
            )}
            {...props}
        >
            {children}
        </select>
    )
}

export function Textarea({ className, ...props }) {
    return (
        <textarea
            className={cn(
                "min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200",
                className
            )}
            {...props}
        />
    )
}

export function Field({ label, hint, children }) {
    return (
        <div className="space-y-1">
            <div className="flex items-end justify-between gap-2">
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
            </div>
            {children}
        </div>
    )
}

export function Card({ children, className }) {
    return (
        <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
            {children}
        </div>
    )
}

export function CardHeader({ title, right, subtitle }) {
    return (
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="text-base font-bold text-slate-900">{title}</div>
                {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
            </div>
            {right ? <div className="flex items-center gap-2">{right}</div> : null}
        </div>
    )
}

export function CardBody({ children, className }) {
    return <div className={cn("px-5 py-4", className)}>{children}</div>
}

export function Divider() {
    return <div className="my-4 h-px w-full bg-slate-100" />
}

export function EmptyState({ title = "No data", desc = "Nothing to show here." }) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <div className="text-sm font-bold text-slate-800">{title}</div>
            <div className="mt-1 text-xs text-slate-500">{desc}</div>
        </div>
    )
}

export function downloadBlob(blob, filename) {
    try {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
        toast.error(e?.message || "Download failed")
    }
}

export function PdfButtons({ onDownload, onPrint }) {
    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onPrint}>
                <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" onClick={onDownload}>
                <Download className="h-4 w-4" /> Download
            </Button>
        </div>
    )
}
