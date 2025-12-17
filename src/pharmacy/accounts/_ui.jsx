import { Badge } from '@/components/ui/badge'

export function Money({ value }) {
    const v = Number(value || 0)
    return (
        <span className="font-medium">
            ₹{v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
    )
}

export function fmtDate(d) {
    if (!d) return '—'
    try {
        return new Date(d).toLocaleDateString('en-IN')
    } catch {
        return String(d)
    }
}

export function StatusBadge({ inv }) {
    if (inv?.is_overdue) {
        return (
            <Badge className="bg-rose-100 text-rose-800 border border-rose-200">
                Overdue
            </Badge>
        )
    }
    if (inv?.status === 'PARTIAL') {
        return (
            <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                Partial
            </Badge>
        )
    }
    if (inv?.status === 'PAID') {
        return (
            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">
                Paid
            </Badge>
        )
    }
    return (
        <Badge className="bg-slate-100 text-slate-800 border border-slate-500">
            Unpaid
        </Badge>
    )
}
