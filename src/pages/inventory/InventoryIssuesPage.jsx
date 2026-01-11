// FILE: src/pages/inventory/InventoryIssuesPage.jsx
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { RefreshCcw, Search, Filter, Truck, ArrowRight } from "lucide-react"

import { useCanFn } from "@/hooks/useCan"
import { invListIssues, invListLocations } from "@/api/inventoryIndent"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import IssueDrawer from "./IssueDrawer"

const cx = (...a) => a.filter(Boolean).join(" ")

const PERMS = {
    ISSUE_VIEW: ["inventory.issues.view", "inventory.issue.view", "inv.issues.view", "inv.issue.view"],
}

const fmtIST = (isoOrDate) => {
    if (!isoOrDate) return "-"
    try {
        const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
        return new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(d)
    } catch {
        return String(isoOrDate)
    }
}

const statusBadge = (s) => {
    const v = String(s || "").toUpperCase()
    const map = {
        DRAFT: "bg-slate-100 text-slate-700",
        POSTED: "bg-emerald-100 text-emerald-800",
        CANCELLED: "bg-rose-100 text-rose-800",
    }
    return map[v] || "bg-slate-100 text-slate-700"
}

export default function InventoryIssuesPage() {
    const { canAny } = useCanFn()
    const canIssueView = canAny(PERMS.ISSUE_VIEW)

    const [locations, setLocations] = useState([])
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [issueId, setIssueId] = useState(null)

    const [q, setQ] = useState("")
    const [filterOpen, setFilterOpen] = useState(false)
    const [filters, setFilters] = useState({
        status: "",
        from_location_id: "",
        to_location_id: "",
    })
    const ALL = "__ALL__"
    const normSelect = (v) => (v === ALL ? "" : v)
    const denormSelect = (v) => (v ? v : ALL)
    const [refetchKey, setRefetchKey] = useState(0)
    const bumpRefetch = () => setRefetchKey((k) => k + 1)

    const loadCatalog = async () => {
        try {
            const locs = await invListLocations({ active: true })
            setLocations(locs.data || [])
        } catch (e) {
            toast.error(e?.message || "Failed to load locations")
        }
    }

    const loadList = async () => {
        if (!canIssueView) return
        try {
            setLoading(true)
            const baseParams = {
                limit: 200,
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.from_location_id ? { from_location_id: Number(filters.from_location_id) } : {}),
                ...(filters.to_location_id ? { to_location_id: Number(filters.to_location_id) } : {}),
            }
            const all = await invListIssues(baseParams)
            const s = q.trim().toLowerCase()
            const final = !s ? all : (all || []).filter((r) => String(r.issue_number || "").toLowerCase().includes(s))
            setRows(final || [])
        } catch (e) {
            toast.error(e?.message || "Failed to load issues")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadCatalog()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        loadList()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchKey])

    if (!canIssueView) {
        return <div className="p-6 text-sm text-muted-foreground">Not permitted.</div>
    }

    return (
        <div className="p-4 md:p-6 space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="text-2xl font-semibold tracking-tight">Pharmacy Issues</div>
                    <div className="text-sm text-muted-foreground">Pharmacy/Stores — Issue → Batch → Post</div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => bumpRefetch()}>
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </motion.div>

            <Card className="rounded-2xl shadow-sm border bg-white">
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-muted-foreground" />
                            <CardTitle className="text-base">Issues</CardTitle>
                            <CardDescription className="hidden md:block">Tap a row to open</CardDescription>
                        </div>

                        <div className="flex flex-col md:flex-row gap-2 md:items-center">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search issue number..." className="pl-9 rounded-xl w-full md:w-[320px]" />
                            </div>

                            <Button variant="outline" className="rounded-xl" onClick={() => setFilterOpen(true)}>
                                <Filter className="w-4 h-4 mr-2" />
                                Filters
                            </Button>

                            <Button className="rounded-xl" onClick={() => bumpRefetch()}>
                                Apply Search
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    {loading ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                                Loading...
                            </span>
                        </div>
                    ) : (rows || []).length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">No issues found.</div>
                    ) : (
                        <div className="grid gap-2">
                            {(rows || []).map((r) => (
                                <button key={r.id} className={cx("text-left w-full rounded-2xl border bg-white shadow-sm", "hover:shadow-md transition p-4")} onClick={() => setIssueId(r.id)}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-semibold truncate">{r.issue_number || `Issue #${r.id}`}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Created: {fmtIST(r.created_at)} • Issue Date: {r.issue_date ? r.issue_date : "-"}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                From: {r.from_location?.name || r.from_location_id} <ArrowRight className="inline w-3 h-3 mx-1" /> To:{" "}
                                                {r.to_location?.name || r.to_location_id}
                                            </div>
                                            {r.indent_id ? <div className="text-xs text-muted-foreground mt-1">Indent ID: {r.indent_id}</div> : null}
                                        </div>

                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <Badge className={cx("rounded-xl", statusBadge(r.status))}>{String(r.status || "").replaceAll("_", " ")}</Badge>
                                            <div className="text-xs text-muted-foreground">Items: {(r.items || []).length}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Filters */}
            <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
                <DialogContent className="max-w-[720px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Filters</DialogTitle>
                        <DialogDescription>Filter issues by status and locations.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Status</Label>
                            <Input value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} placeholder="DRAFT / POSTED / CANCELLED" className="rounded-xl" />
                        </div>

                        <div className="space-y-1">
                            <Label>From Location</Label>
                            <Select
                                value={denormSelect(filters.from_location_id)}
                                onValueChange={(v) => setFilters((p) => ({ ...p, from_location_id: normSelect(v) }))}
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All</SelectItem>
                                    {(locations || []).map((l) => (
                                        <SelectItem key={l.id} value={String(l.id)}>
                                            {l.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>


                        <div className="space-y-1">
                            <Label>To Location</Label>
                            <Select
                                value={denormSelect(filters.to_location_id)}
                                onValueChange={(v) => setFilters((p) => ({ ...p, to_location_id: normSelect(v) }))}
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All</SelectItem>
                                    {(locations || []).map((l) => (
                                        <SelectItem key={l.id} value={String(l.id)}>
                                            {l.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() =>
                                setFilters({
                                    status: "",
                                    from_location_id: "",
                                    to_location_id: "",
                                })
                            }
                        >
                            Reset
                        </Button>
                        <Button
                            className="rounded-xl"
                            onClick={() => {
                                setFilterOpen(false)
                                bumpRefetch()
                            }}
                        >
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Drawer */}
            <IssueDrawer open={!!issueId} issueId={issueId} onOpenChange={(v) => !v && setIssueId(null)} onChanged={() => bumpRefetch()} />
        </div>
    )
}
