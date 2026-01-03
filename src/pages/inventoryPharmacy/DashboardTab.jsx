// FILE: src/pages/inventoryPharmacy/DashboardTab.jsx
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { AlertTriangle, Activity, MoreVertical } from "lucide-react"

import { Donut, MiniBar, GLASS_CARD, formatDate, formatNumber } from "./ui"


export default function DashboardTab({
    stockLoading,
    expiryAlerts,
    expiredAlerts,
    lowStock,
    maxStock,
    quarantineStock,
    activeLocation,
    lastRefreshedAt,
    startReturnForBatch,
}) {
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <Card className={GLASS_CARD}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Expiry alerts
                        <Badge variant="outline" className="text-xs">
                            {expiryAlerts.length + expiredAlerts.length}
                        </Badge>
                    </CardTitle>
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                </CardHeader>

                <CardContent className="space-y-3 max-h-[340px] overflow-auto">
                    {stockLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : expiryAlerts.length === 0 && expiredAlerts.length === 0 ? (
                        <p className="text-sm text-slate-500">
                            No expiry issues for {activeLocation ? activeLocation.name : "all locations"}.
                        </p>
                    ) : (
                        <>
                            {expiredAlerts.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">
                                        Expired on shelf
                                    </p>
                                    <div className="space-y-1.5">
                                        {expiredAlerts.slice(0, 30).map((b) => (
                                            <div
                                                key={`expired-${b.id}`}
                                                className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">
                                                        {b.item?.name || b.name || b.item_name || `Item #${b.item_id ?? ""}`}
                                                        {b.batch_no ? (
                                                            <span className="text-xs text-slate-500"> ({b.batch_no})</span>
                                                        ) : null}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        Qty: {formatNumber(b.current_qty)} • Expired: {formatDate(b.expiry_date)}
                                                    </p>
                                                </div>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="rounded-2xl h-9 w-9 bg-white/70"
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-2xl">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => startReturnForBatch(b, "EXPIRED")}>
                                                            Create return
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {expiryAlerts.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                                        Near expiry
                                    </p>
                                    <div className="space-y-1.5">
                                        {expiryAlerts.slice(0, 30).map((b) => (
                                            <div
                                                key={`near-${b.id}`}
                                                className="flex items-center justify-between rounded-2xl border border-slate-500 px-3 py-2 bg-slate-50"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">
                                                        {b.item?.name || b.name || b.item_name || `Item #${b.item_id ?? ""}`}
                                                        {b.batch_no ? (
                                                            <span className="text-xs text-slate-500"> ({b.batch_no})</span>
                                                        ) : null}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        Qty: {formatNumber(b.current_qty)} • Exp: {formatDate(b.expiry_date)}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="text-xs rounded-full">
                                                    Exp: {formatDate(b.expiry_date)}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className={GLASS_CARD}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            Inventory health
                            <Badge variant="outline" className="text-xs">
                                {lowStock.length + maxStock.length}
                            </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Quick “NUTRYAH Health style” view of risk areas.
                        </CardDescription>
                    </div>
                    <Activity className="w-4 h-4 text-sky-500" />
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Donut
                            label="Expiry risk"
                            value={expiredAlerts.length}
                            total={Math.max(1, expiredAlerts.length + expiryAlerts.length)}
                            accent="#ef4444"
                        />
                        <Donut
                            label="Stock risk"
                            value={lowStock.length}
                            total={Math.max(1, lowStock.length + maxStock.length)}
                            accent="#0ea5e9"
                        />
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-500/70 bg-white/60 p-3">
                        <MiniBar
                            label="Low stock items"
                            value={lowStock.length}
                            max={Math.max(1, lowStock.length + maxStock.length)}
                            accent="bg-amber-500"
                        />
                        <MiniBar
                            label="Over-stock items"
                            value={maxStock.length}
                            max={Math.max(1, lowStock.length + maxStock.length)}
                            accent="bg-sky-500"
                        />
                        <MiniBar
                            label="Quarantine batches"
                            value={quarantineStock.length}
                            max={Math.max(1, quarantineStock.length + expiredAlerts.length)}
                            accent="bg-slate-700"
                        />
                    </div>

                    <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>
                            Location:{" "}
                            <span className="text-slate-900 font-medium">{activeLocation?.name || "All"}</span>
                        </span>
                        <span>
                            Refreshed:{" "}
                            <span className="text-slate-900 font-medium">
                                {lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString() : "—"}
                            </span>
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
