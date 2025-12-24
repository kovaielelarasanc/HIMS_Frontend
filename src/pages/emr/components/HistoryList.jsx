// frontend/src/components/emr/HistoryList.jsx
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export default function HistoryList({
    title = "History",
    countLabel,
    loading,
    items = [],
    emptyText = "No records found.",
    renderItem,
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-800">{title}</div>
                <Badge variant="secondary">
                    {loading ? "Loading..." : countLabel ?? `${items.length} record(s)`}
                </Badge>
            </div>

            {loading && (
                <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            )}

            {!loading && items.length === 0 && (
                <div className="rounded-xl border p-5 text-slate-600">{emptyText}</div>
            )}

            {!loading && items.map((it, idx) => renderItem?.(it, idx))}
        </div>
    )
}
