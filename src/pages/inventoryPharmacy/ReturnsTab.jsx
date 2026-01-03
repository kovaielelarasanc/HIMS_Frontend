// FILE: src/pages/inventoryPharmacy/ReturnsTab.jsx
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

import { Plus } from "lucide-react"
import { GLASS_CARD, formatDate } from "./UI"

export default function ReturnsTab({
    returns,
    returnLoading,
    onNewReturn,
    onPostReturn,
}) {
    return (
        <Card className={GLASS_CARD}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Returns
                        <Badge variant="outline" className="text-xs">
                            {returns.length}
                        </Badge>
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                        Returns to suppliers, from customers, and internal adjustments.
                    </p>
                </div>
                <Button size="sm" className="gap-1 rounded-2xl" onClick={onNewReturn}>
                    <Plus className="w-3 h-3" />
                    New return
                </Button>
            </CardHeader>

            <CardContent>
                <div className="border border-slate-500/70 rounded-2xl overflow-hidden bg-white/70 backdrop-blur">
                    <div className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                        <span>Return no.</span>
                        <span>Type / supplier</span>
                        <span>Location / reason</span>
                        <span>Status</span>
                        <span className="text-right">Actions</span>
                    </div>

                    <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                        {returnLoading ? (
                            <div className="p-3 space-y-2">
                                <Skeleton className="h-7 w-full" />
                                <Skeleton className="h-7 w-full" />
                                <Skeleton className="h-7 w-full" />
                            </div>
                        ) : returns.length === 0 ? (
                            <div className="p-4 text-sm text-slate-500">No returns recorded yet.</div>
                        ) : (
                            returns.map((rn) => (
                                <div
                                    key={rn.id}
                                    className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr] items-center px-3 py-2 text-xs"
                                >
                                    <div>
                                        <p className="font-medium text-slate-900">{rn.return_number}</p>
                                        <p className="text-slate-500">Date: {formatDate(rn.return_date)}</p>
                                    </div>

                                    <div>
                                        <p className="text-slate-900">{String(rn.type || "").replace("_", " ")}</p>
                                        <p className="text-slate-500 text-[11px]">{rn.supplier?.name || "—"}</p>
                                    </div>

                                    <div>
                                        <p className="text-slate-900">{rn.location?.name}</p>
                                        <p className="text-slate-500 text-[11px]">{rn.reason || "—"}</p>
                                    </div>

                                    <div>
                                        <Badge variant="outline" className="text-[10px] capitalize rounded-full">
                                            {String(rn.status || "").toLowerCase()}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        {rn.status === "DRAFT" ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 px-3 rounded-2xl bg-white/70 text-[11px]"
                                                onClick={() => onPostReturn(rn.id)}
                                            >
                                                Post return
                                            </Button>
                                        ) : (
                                            <span className="text-[11px] text-slate-400">—</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
