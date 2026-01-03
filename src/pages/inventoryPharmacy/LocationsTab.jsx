// FILE: src/pages/inventoryPharmacy/LocationsTab.jsx
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Plus, MoreVertical, Eye, Copy, Search, MapPin } from "lucide-react"
import { GLASS_CARD } from "./UI"

export default function LocationsTab({ locations, onNewLocation, onEditLocation, onCopy }) {
    const [q, setQ] = useState("")

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase()
        if (!s) return locations || []
        return (locations || []).filter((l) => {
            const code = (l?.code || "").toLowerCase()
            const name = (l?.name || "").toLowerCase()
            const desc = (l?.description || "").toLowerCase()
            return code.includes(s) || name.includes(s) || desc.includes(s)
        })
    }, [locations, q])

    return (
        <Card className={GLASS_CARD}>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Inventory locations
                        <Badge variant="outline" className="text-xs">
                            {filtered.length}
                        </Badge>
                    </CardTitle>
                    <p className="text-xs text-slate-500">Define pharmacy / store locations for stock segregation.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search location…"
                            className="h-10 rounded-2xl pl-9 bg-white/70"
                        />
                    </div>

                    <Button size="sm" className="gap-1 rounded-2xl" onClick={onNewLocation}>
                        <Plus className="w-3 h-3" />
                        New location
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {filtered.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200 bg-white/60 backdrop-blur p-8 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                            <MapPin className="h-5 w-5 text-slate-500" />
                        </div>
                        <div className="text-sm font-semibold text-slate-900">No locations found</div>
                        <div className="mt-1 text-xs text-slate-500">
                            Try a different keyword, or create a new location.
                        </div>
                        <div className="mt-4">
                            <Button className="rounded-2xl" onClick={onNewLocation}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create location
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((loc) => (
                            <div
                                key={loc.id}
                                className="group rounded-3xl border border-slate-200 bg-white/70 backdrop-blur shadow-sm transition hover:shadow-md hover:bg-white"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm font-semibold text-slate-900 truncate">
                                                    {loc.name}
                                                </div>
                                                {loc.code ? (
                                                    <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5">
                                                        {loc.code}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5">
                                                        —
                                                    </Badge>
                                                )}
                                            </div>

                                            {loc.description ? (
                                                <div className="mt-1 text-xs text-slate-500 line-clamp-2">
                                                    {loc.description}
                                                </div>
                                            ) : (
                                                <div className="mt-1 text-xs text-slate-400 italic">
                                                    No description
                                                </div>
                                            )}
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-2xl bg-white/70 border-slate-200 hover:bg-white"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>

                                            <DropdownMenuContent align="end" className="rounded-2xl">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => onEditLocation(loc)}>
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    View / Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onCopy(loc.name, "Location name copied")}>
                                                    <Copy className="w-4 h-4 mr-2" />
                                                    Copy name
                                                </DropdownMenuItem>
                                                {loc.code ? (
                                                    <DropdownMenuItem onClick={() => onCopy(loc.code, "Location code copied")}>
                                                        <Copy className="w-4 h-4 mr-2" />
                                                        Copy code
                                                    </DropdownMenuItem>
                                                ) : null}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="text-[11px] text-slate-500">
                                            Location ID:{" "}
                                            <span className="font-medium text-slate-900">{loc.id}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-2xl bg-white/70 border-slate-200 hover:bg-white"
                                                onClick={() => onCopy(loc.name, "Location name copied")}
                                            >
                                                <Copy className="h-3.5 w-3.5 mr-2" />
                                                Copy
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="rounded-2xl"
                                                onClick={() => onEditLocation(loc)}
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-2" />
                                                Open
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* subtle bottom accent */}
                                <div className="h-1 w-full rounded-b-3xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 opacity-70 group-hover:opacity-100 transition" />
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
