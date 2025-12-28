// FILE: src/ipd/tabs/BedTransferTab.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
    BedDouble,
    AlertTriangle,
    ArrowRightLeft,
    CheckCircle2,
    XCircle,
    Clock,
    Ban,
    ShieldCheck,
    UserCheck,
    ClipboardCheck,
    RefreshCcw,
    ChevronDown,
    ChevronUp,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Input } from "../../components/ui/input"
import { Textarea } from "../../components/ui/textarea"
import { Dialog, DialogContent } from "../../components/ui/dialog"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../../components/ui/select"

import { cx as cn, fmtIST } from "../nursing/ui/utils"
import {
    listTransfers,
    requestTransfer,
    approveTransfer,
    assignTransferBed,
    completeTransfer,
    cancelTransfer,
} from "../../api/ipd"

import WardRoomBedPicker from "../components/WardRoomBedPicker"

// ✅ IMPORTANT: permission hook
import { useCan, useCanAny } from "../../hooks/useCan"

const STATUS_META = {
    requested: { label: "Requested", tone: "bg-amber-50 text-amber-800 border-amber-200", icon: Clock },
    approved: { label: "Approved", tone: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: ShieldCheck },
    rejected: { label: "Rejected", tone: "bg-rose-50 text-rose-800 border-rose-200", icon: XCircle },
    scheduled: { label: "Scheduled", tone: "bg-sky-50 text-sky-800 border-sky-200", icon: Clock },
    completed: { label: "Completed", tone: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", tone: "bg-slate-100 text-slate-700 border-slate-200", icon: Ban },
}

const TYPE_LABEL = {
    transfer: "Transfer",
    upgrade: "Upgrade",
    downgrade: "Downgrade",
    isolation: "Isolation",
    operational: "Operational",
}

const PRIORITY_META = {
    routine: { label: "ROUTINE", tone: "bg-slate-100 text-slate-700" },
    urgent: { label: "URGENT", tone: "bg-rose-50 text-rose-800" },
}

const toIsoSecs = (v) => (!v ? null : v.length === 16 ? `${v}:00` : v)

function unwrapList(maybe) {
    const d = maybe?.data ?? maybe
    if (Array.isArray(d)) return d
    if (Array.isArray(d?.items)) return d.items
    if (Array.isArray(d?.results)) return d.results
    if (Array.isArray(d?.data?.items)) return d.data.items
    if (Array.isArray(d?.data?.results)) return d.data.results
    if (Array.isArray(d?.data?.data?.items)) return d.data.data.items
    if (Array.isArray(d?.data?.data?.results)) return d.data.data.results
    return []
}

function apiMsg(e, fallback = "Something went wrong") {
    const st = e?.response?.status
    const msg =
        e?.response?.data?.error?.msg ||
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message

    if (st === 403) return "Not permitted"
    return msg || fallback
}

function StatusPill({ status }) {
    const meta = STATUS_META[status] || STATUS_META.requested
    const Icon = meta.icon
    return (
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]", meta.tone)}>
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
        </span>
    )
}

function LocLine({ label, loc }) {
    if (!loc) return null
    return (
        <div className="text-[12px] text-slate-700">
            <span className="text-slate-500">{label}:</span>{" "}
            <span className="font-medium">
                {loc.bed_code || "—"}
                {loc.ward_name ? <span className="text-slate-500"> • {loc.ward_name}</span> : null}
                {loc.room_number ? <span className="text-slate-500"> • Room {loc.room_number}</span> : null}
            </span>
        </div>
    )
}

/** Apple-premium modal frame: mobile full-ish + sticky header/footer */
function ModalFrame({ icon: Icon, title, description, children, footer }) {
    return (
        <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl bg-white sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
                <div className="flex items-start gap-3">
                    {Icon ? (
                        <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
                            <Icon className="h-5 w-5" />
                        </div>
                    ) : null}
                    <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-slate-900">{title}</div>
                        {description ? <div className="mt-0.5 text-[12px] text-slate-600">{description}</div> : null}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>

            <div className="sticky bottom-0 z-10 border-t bg-white/80 px-4 py-3 backdrop-blur sm:px-6">{footer}</div>
        </div>
    )
}

function TransferCard({
    t,
    expanded,
    onToggle,
    onReview,
    onAssign,
    onComplete,
    onCancel,
    loading,
    canDoApprove,
    canDoComplete,
    canDoCancel,
}) {
    const status = t.status || "requested"
    const pr = PRIORITY_META[t.priority] || PRIORITY_META.routine
    const isPending = status === "requested"
    const canAssignNow = status === "approved" || status === "scheduled"
    const canCompleteNow = status === "approved" || status === "scheduled"
    const canCancelNow = status !== "completed" && status !== "cancelled"
    const hasTarget = !!t?.to_location?.bed_id || !!t?.to_bed_id

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,.02)] md:p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={status} />
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                            {TYPE_LABEL[t.transfer_type] || t.transfer_type || "Transfer"}
                        </span>
                        <span className={cn("rounded-full px-2 py-1 text-[11px]", pr.tone)}>{pr.label}</span>
                        <span className="text-[11px] text-slate-500">#{t.id}</span>
                    </div>

                    <div className="mt-2 grid gap-1">
                        <LocLine label="From" loc={t.from_location} />
                        <LocLine label="To" loc={t.to_location} />

                        <div className="text-[12px] text-slate-700">
                            <span className="text-slate-500">Reason:</span>{" "}
                            <span className="font-medium">{t.reason || "—"}</span>
                        </div>

                        {expanded ? (
                            <>
                                {t.request_note ? <div className="text-[12px] text-slate-600">{t.request_note}</div> : null}

                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                    <span>Requested: {t.requested_at ? fmtIST(t.requested_at) : "—"}</span>
                                    {t.approved_at ? <span>Approved: {fmtIST(t.approved_at)}</span> : null}
                                    {t.scheduled_at ? <span>Scheduled: {fmtIST(t.scheduled_at)}</span> : null}
                                    {t.completed_at ? <span>Completed: {fmtIST(t.completed_at)}</span> : null}
                                </div>

                                {t.rejected_reason ? (
                                    <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                                        Rejected: {t.rejected_reason}
                                    </div>
                                ) : null}

                                {t.cancel_reason ? (
                                    <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                                        Cancelled: {t.cancel_reason}
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <div className="mt-1 text-[11px] text-slate-500">
                                {t.requested_at ? `Requested: ${fmtIST(t.requested_at)}` : "—"}
                                {t.scheduled_at ? ` • Scheduled: ${fmtIST(t.scheduled_at)}` : ""}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onToggle}
                        className="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {expanded ? "Less" : "More"}
                    </button>
                </div>

                <div className="mt-1 flex flex-wrap gap-2 md:mt-0 md:justify-end">
                    {isPending && canDoApprove ? (
                        <Button
                            size="sm"
                            className="h-9 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={onReview}
                            disabled={loading}
                        >
                            <UserCheck className="mr-2 h-4 w-4" />
                            Review
                        </Button>
                    ) : null}

                    {canAssignNow && canDoApprove ? (
                        <Button size="sm" variant="outline" className="h-9 rounded-full" onClick={onAssign} disabled={loading}>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Assign bed
                        </Button>
                    ) : null}

                    {canCompleteNow && canDoComplete ? (
                        <Button
                            size="sm"
                            className="h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                            onClick={onComplete}
                            disabled={loading || !hasTarget}
                            title={!hasTarget ? "Assign target bed first" : ""}
                        >
                            <ClipboardCheck className="mr-2 h-4 w-4" />
                            Complete
                        </Button>
                    ) : null}

                    {canCancelNow && canDoCancel ? (
                        <Button size="sm" variant="outline" className="h-9 rounded-full" onClick={onCancel} disabled={loading}>
                            <Ban className="mr-2 h-4 w-4" />
                            Cancel
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

export default function BedTransferTab({
    admission,
    beds = [],
    // ⚠️ keep props optional (fallback), but permissions are primarily from useCan
    canWrite,
    canApprove: canApproveProp = false,
    canComplete: canCompleteProp = false,
    canCancel: canCancelProp = false,
    onChanged,
}) {
    const admissionId = admission?.id

    // ✅ REAL permissions
    const canView = useCanAny(["ipd.transfers.view", "ipd.admissions.view"])
    const pCreate = useCan("ipd.transfers.create")
    const pApprove = useCan("ipd.transfers.approve")
    const pComplete = useCan("ipd.transfers.complete")
    const pCancel = useCan("ipd.transfers.cancel")

    // ✅ UI permissions (permission code OR fallback props)
    const canCreate = !!(pCreate || canWrite)
    const canDoApprove = !!(pApprove || canApproveProp)
    const canDoComplete = !!(pComplete || canCompleteProp)
    const canDoCancel = !!(pCancel || canCancelProp)

    const currentBed = useMemo(() => {
        if (!admission?.current_bed_id) return null
        return beds.find((b) => b.id === admission.current_bed_id) || null
    }, [admission?.current_bed_id, beds])

    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [error, setError] = useState("")
    const [expandedId, setExpandedId] = useState(null)

    // dialogs
    const [openRequest, setOpenRequest] = useState(false)
    const [openApprove, setOpenApprove] = useState(false)
    const [openAssign, setOpenAssign] = useState(false)
    const [openComplete, setOpenComplete] = useState(false)
    const [openCancel, setOpenCancel] = useState(false)
    const [active, setActive] = useState(null)

    // request form
    const [reqType, setReqType] = useState("transfer")
    const [reqPriority, setReqPriority] = useState("routine")
    const [reqReason, setReqReason] = useState("")
    const [reqNote, setReqNote] = useState("")
    const [reqBedId, setReqBedId] = useState("")
    const [reqSchedule, setReqSchedule] = useState("")
    const [reqReserveMin, setReqReserveMin] = useState(30)

    // approve form
    const [apNote, setApNote] = useState("")
    const [rejReason, setRejReason] = useState("")

    // assign form
    const [asBedId, setAsBedId] = useState("")
    const [asSchedule, setAsSchedule] = useState("")
    const [asReserveMin, setAsReserveMin] = useState(30)

    // complete form
    const [cpVacated, setCpVacated] = useState("")
    const [cpOccupied, setCpOccupied] = useState("")
    const [handover, setHandover] = useState({
        identity_verified: true,
        allergies_checked: false,
        vitals_taken: false,
        belongings_checked: true,
        med_chart_transferred: true,
        oxygen_arranged: false,
        escort_name: "",
        notes: "",
    })

    // cancel form
    const [cancelReason, setCancelReason] = useState("")

    const stats = useMemo(() => {
        const total = rows.length
        const pending = rows.filter((r) => (r.status || "requested") === "requested").length
        const scheduled = rows.filter((r) => (r.status || "") === "scheduled").length
        return { total, pending, scheduled }
    }, [rows])

    const refresh = async () => {
        if (!admissionId) return
        if (!canView) {
            setRows([])
            setError("Not permitted to view transfers")
            return
        }
        setLoading(true)
        setError("")
        try {
            const res = await listTransfers(admissionId)
            const list = unwrapList(res)
            setRows(list)
            if (!expandedId && list?.[0]?.id) setExpandedId(list[0].id)
        } catch (e) {
            console.error(e)
            setError(apiMsg(e, "Failed to load transfers"))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId, canView])

    const resetRequest = () => {
        setReqType("transfer")
        setReqPriority("routine")
        setReqReason("")
        setReqNote("")
        setReqBedId("")
        setReqSchedule("")
        setReqReserveMin(30)
    }

    const submitRequest = async () => {
        if (!admissionId) return
        if (!canCreate) {
            toast.error("Not permitted")
            return
        }
        if (!reqReason.trim()) {
            toast.error("Reason is required")
            return
        }
        setLoading(true)
        try {
            const payload = {
                transfer_type: reqType,
                priority: reqPriority,
                reason: reqReason.trim(),
                request_note: reqNote || "",
                to_bed_id: reqBedId ? Number(reqBedId) : null,
                scheduled_at: reqSchedule ? toIsoSecs(reqSchedule) : null,
                reserve_minutes: Number(reqReserveMin || 0),
            }
            await requestTransfer(admissionId, payload)
            toast.success("Transfer request created")
            setOpenRequest(false)
            await refresh()
            onChanged?.()
        } catch (e) {
            console.error(e)
            toast.error(apiMsg(e, "Failed to create request"))
        } finally {
            setLoading(false)
        }
    }

    const doApprove = async (approve = true) => {
        if (!active) return
        if (!canDoApprove) {
            toast.error("Not permitted")
            return
        }
        setLoading(true)
        try {
            await approveTransfer(active.id, {
                approve,
                approval_note: apNote || "",
                rejected_reason: approve ? "" : (rejReason || "Rejected"),
            })
            toast.success(approve ? "Approved" : "Rejected")
            setOpenApprove(false)
            await refresh()
            onChanged?.()
        } catch (e) {
            console.error(e)
            toast.error(apiMsg(e, "Failed"))
        } finally {
            setLoading(false)
        }
    }

    const doAssign = async () => {
        if (!active) return
        if (!canDoApprove) {
            toast.error("Not permitted")
            return
        }
        if (!asBedId) {
            toast.error("Select a target bed")
            return
        }
        setLoading(true)
        try {
            await assignTransferBed(active.id, {
                to_bed_id: Number(asBedId),
                scheduled_at: asSchedule ? toIsoSecs(asSchedule) : null,
                reserve_minutes: Number(asReserveMin || 0),
            })
            toast.success("Bed assigned")
            setOpenAssign(false)
            await refresh()
            onChanged?.()
        } catch (e) {
            console.error(e)
            toast.error(apiMsg(e, "Failed to assign bed"))
        } finally {
            setLoading(false)
        }
    }

    const doComplete = async () => {
        if (!active) return
        if (!canDoComplete) {
            toast.error("Not permitted")
            return
        }
        setLoading(true)
        try {
            await completeTransfer(active.id, {
                vacated_at: cpVacated ? toIsoSecs(cpVacated) : null,
                occupied_at: cpOccupied ? toIsoSecs(cpOccupied) : null,
                handover,
            })
            toast.success("Transfer completed")
            setOpenComplete(false)
            await refresh()
            onChanged?.()
        } catch (e) {
            console.error(e)
            toast.error(apiMsg(e, "Failed to complete transfer"))
        } finally {
            setLoading(false)
        }
    }

    const doCancel = async () => {
        if (!active) return
        if (!canDoCancel) {
            toast.error("Not permitted")
            return
        }
        setLoading(true)
        try {
            await cancelTransfer(active.id, { reason: cancelReason || "" })
            toast.success("Transfer cancelled")
            setOpenCancel(false)
            await refresh()
            onChanged?.()
        } catch (e) {
            console.error(e)
            toast.error(apiMsg(e, "Failed to cancel"))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <Card className="rounded-3xl border-0 bg-gradient-to-r from-sky-50 via-white to-violet-50 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
                        <BedDouble className="h-4 w-4 text-sky-600" />
                        Bed / Transfer
                    </CardTitle>
                    <div className="text-[12px] text-slate-600">Request → approve → assign → complete (auditable).</div>
                </CardHeader>

                <CardContent className="pt-0">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <div className="text-[12px] text-slate-600">
                                Current bed: <span className="font-semibold text-slate-900">{currentBed?.code || "—"}</span>
                                {currentBed?.ward_name ? <span className="ml-1 text-slate-500">({currentBed.ward_name})</span> : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className="rounded-full bg-white/70 text-slate-700 border border-slate-200">Total: {stats.total}</Badge>
                                <Badge className="rounded-full bg-amber-50 text-amber-800 border border-amber-200">Pending: {stats.pending}</Badge>
                                <Badge className="rounded-full bg-sky-50 text-sky-800 border border-sky-200">Scheduled: {stats.scheduled}</Badge>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            <Badge
                                className={cn(
                                    "rounded-full",
                                    canCreate ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                                )}
                            >
                                {canCreate ? "Request enabled" : "View only"}
                            </Badge>

                            <Button variant="outline" className="h-9 rounded-full" onClick={refresh} disabled={loading}>
                                <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                                Refresh
                            </Button>

                            {canCreate && (
                                <Button
                                    className="h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800"
                                    onClick={() => {
                                        resetRequest()
                                        setOpenRequest(true)
                                    }}
                                    disabled={loading}
                                >
                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                    New request
                                </Button>
                            )}
                        </div>
                    </div>

                    {!canView ? (
                        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            You don’t have permission to view transfers.
                        </div>
                    ) : null}

                    {error ? <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-[12px] text-rose-800">{error}</div> : null}
                </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="rounded-3xl border-0 bg-white shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-900">Transfer timeline</CardTitle>
                    <div className="text-[12px] text-slate-600">Tap “More” to view full audit trail.</div>
                </CardHeader>

                <CardContent className="space-y-3">
                    {!canView ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-600">
                            Not permitted.
                        </div>
                    ) : (
                        <>
                            {loading && rows.length === 0 ? (
                                <div className="rounded-2xl bg-slate-50 p-4 text-[12px] text-slate-600">Loading…</div>
                            ) : null}

                            {!loading && rows.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                                    <div className="text-[13px] font-semibold text-slate-900">No transfers yet</div>
                                    <div className="mt-1 text-[12px] text-slate-600">Create a request to start.</div>
                                </div>
                            ) : null}

                            <div className="space-y-3">
                                {rows.map((t) => (
                                    <TransferCard
                                        key={t.id}
                                        t={t}
                                        expanded={expandedId === t.id}
                                        onToggle={() => setExpandedId((cur) => (cur === t.id ? null : t.id))}
                                        loading={loading}
                                        canDoApprove={canDoApprove}
                                        canDoComplete={canDoComplete}
                                        canDoCancel={canDoCancel}
                                        onReview={() => {
                                            setActive(t)
                                            setApNote("")
                                            setRejReason("")
                                            setOpenApprove(true)
                                        }}
                                        onAssign={() => {
                                            setActive(t)
                                            setAsBedId(t?.to_location?.bed_id ? String(t.to_location.bed_id) : "")
                                            setAsSchedule(t?.scheduled_at ? String(t.scheduled_at).slice(0, 16) : "")
                                            setAsReserveMin(30)
                                            setOpenAssign(true)
                                        }}
                                        onComplete={() => {
                                            setActive(t)
                                            setCpVacated("")
                                            setCpOccupied("")
                                            setHandover((h) => ({ ...h, escort_name: "", notes: "" }))
                                            setOpenComplete(true)
                                        }}
                                        onCancel={() => {
                                            setActive(t)
                                            setCancelReason("")
                                            setOpenCancel(true)
                                        }}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ============== Request Dialog ============== */}
            <Dialog open={openRequest} onOpenChange={setOpenRequest}>
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-none rounded-2xl p-0 sm:max-w-2xl sm:rounded-3xl">
                    <ModalFrame
                        icon={ArrowRightLeft}
                        title="New transfer request"
                        description="Fast mobile input + clean desktop layout."
                        footer={
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="outline" className="h-9 rounded-full" onClick={() => setOpenRequest(false)}>
                                    Close
                                </Button>
                                <Button className="h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={submitRequest} disabled={loading}>
                                    Create request
                                </Button>
                            </div>
                        }
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Transfer type</div>
                                <Select value={reqType} onValueChange={setReqType}>
                                    <SelectTrigger className="h-10 rounded-2xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="transfer">Transfer</SelectItem>
                                        <SelectItem value="upgrade">Upgrade</SelectItem>
                                        <SelectItem value="downgrade">Downgrade</SelectItem>
                                        <SelectItem value="isolation">Isolation</SelectItem>
                                        <SelectItem value="operational">Operational</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Priority</div>
                                <Select value={reqPriority} onValueChange={setReqPriority}>
                                    <SelectTrigger className="h-10 rounded-2xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="routine">Routine</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="sm:col-span-2 space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Reason *</div>
                                <Input className="h-10 rounded-2xl" value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
                            </div>

                            <div className="sm:col-span-2 space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Request note</div>
                                <Textarea className="min-h-[90px] rounded-2xl" value={reqNote} onChange={(e) => setReqNote(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Schedule (optional)</div>
                                <Input type="datetime-local" className="h-10 rounded-2xl" value={reqSchedule} onChange={(e) => setReqSchedule(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Reserve minutes</div>
                                <Input type="number" className="h-10 rounded-2xl" value={reqReserveMin} onChange={(e) => setReqReserveMin(Number(e.target.value || 0))} min={0} max={1440} />
                            </div>

                            <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Target bed (optional)</div>
                                    <span className="text-[11px] text-slate-500">You can assign later</span>
                                </div>
                                <WardRoomBedPicker value={reqBedId} onChange={(bedId) => setReqBedId(bedId ? String(bedId) : "")} />
                            </div>
                        </div>
                    </ModalFrame>
                </DialogContent>
            </Dialog>

            {/* ============== Approve Dialog ============== */}
            <Dialog open={openApprove} onOpenChange={setOpenApprove}>
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-none rounded-2xl p-0 sm:max-w-xl sm:rounded-3xl">
                    <ModalFrame
                        icon={UserCheck}
                        title="Review transfer request"
                        description="Approve or reject with notes."
                        footer={
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="outline" className="h-9 rounded-full" onClick={() => setOpenApprove(false)}>
                                    Close
                                </Button>
                                <Button variant="outline" className="h-9 rounded-full border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => doApprove(false)} disabled={loading}>
                                    Reject
                                </Button>
                                <Button className="h-9 rounded-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => doApprove(true)} disabled={loading}>
                                    Approve
                                </Button>
                            </div>
                        }
                    >
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
                                <div className="font-semibold text-slate-900">{active?.reason || "—"}</div>
                                {active?.request_note ? <div className="mt-1 text-slate-600">{active.request_note}</div> : null}
                            </div>

                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Approval note</div>
                                <Textarea className="min-h-[90px] rounded-2xl" value={apNote} onChange={(e) => setApNote(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Rejection reason</div>
                                <Input className="h-10 rounded-2xl" value={rejReason} onChange={(e) => setRejReason(e.target.value)} />
                            </div>
                        </div>
                    </ModalFrame>
                </DialogContent>
            </Dialog>

            {/* ============== Assign Dialog ============== */}
            <Dialog open={openAssign} onOpenChange={setOpenAssign}>
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-none rounded-2xl p-0 sm:max-w-2xl sm:rounded-3xl">
                    <ModalFrame
                        icon={ShieldCheck}
                        title="Assign target bed"
                        description="Pick bed + optional schedule/reserve."
                        footer={
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="outline" className="h-9 rounded-full" onClick={() => setOpenAssign(false)}>
                                    Close
                                </Button>
                                <Button className="h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={doAssign} disabled={loading}>
                                    Assign
                                </Button>
                            </div>
                        }
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-slate-50 p-3">
                                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Select bed</div>
                                <WardRoomBedPicker value={asBedId} onChange={(bedId) => setAsBedId(bedId ? String(bedId) : "")} />
                            </div>

                            <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Schedule (optional)</div>
                                    <Input type="datetime-local" className="h-10 rounded-2xl" value={asSchedule} onChange={(e) => setAsSchedule(e.target.value)} />
                                </div>

                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Reserve minutes</div>
                                    <Input type="number" className="h-10 rounded-2xl" value={asReserveMin} onChange={(e) => setAsReserveMin(Number(e.target.value || 0))} min={0} max={1440} />
                                </div>
                            </div>
                        </div>
                    </ModalFrame>
                </DialogContent>
            </Dialog>

            {/* ============== Complete Dialog ============== */}
            <Dialog open={openComplete} onOpenChange={setOpenComplete}>
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-none rounded-2xl p-0 sm:max-w-2xl sm:rounded-3xl">
                    <ModalFrame
                        icon={ClipboardCheck}
                        title="Complete transfer"
                        description="Confirm timing + handover checklist."
                        footer={
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="outline" className="h-9 rounded-full" onClick={() => setOpenComplete(false)}>
                                    Close
                                </Button>
                                <Button className="h-9 rounded-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={doComplete} disabled={loading}>
                                    Complete transfer
                                </Button>
                            </div>
                        }
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Timing</div>
                                <div className="space-y-2">
                                    <div className="text-[11px] text-slate-600">Vacated at (optional)</div>
                                    <Input type="datetime-local" className="h-10 rounded-2xl" value={cpVacated} onChange={(e) => setCpVacated(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <div className="text-[11px] text-slate-600">Occupied at (optional)</div>
                                    <Input type="datetime-local" className="h-10 rounded-2xl" value={cpOccupied} onChange={(e) => setCpOccupied(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Handover checklist</div>

                                {[
                                    ["identity_verified", "Patient identity verified"],
                                    ["belongings_checked", "Belongings checklist done"],
                                    ["med_chart_transferred", "Medication chart / orders accessible"],
                                    ["vitals_taken", "Vitals taken at shifting"],
                                    ["allergies_checked", "Allergies reviewed"],
                                    ["oxygen_arranged", "Oxygen arranged (if needed)"],
                                ].map(([key, label]) => (
                                    <label key={key} className="flex items-center gap-2 text-[12px] text-slate-700">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                                            checked={!!handover[key]}
                                            onChange={(e) => setHandover((h) => ({ ...h, [key]: e.target.checked }))}
                                        />
                                        {label}
                                    </label>
                                ))}

                                <div className="space-y-2">
                                    <div className="text-[11px] text-slate-600">Escort name (optional)</div>
                                    <Input className="h-10 rounded-2xl" value={handover.escort_name || ""} onChange={(e) => setHandover((h) => ({ ...h, escort_name: e.target.value }))} />
                                </div>

                                <div className="space-y-2">
                                    <div className="text-[11px] text-slate-600">Notes</div>
                                    <Textarea className="min-h-[70px] rounded-2xl" value={handover.notes || ""} onChange={(e) => setHandover((h) => ({ ...h, notes: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                    </ModalFrame>
                </DialogContent>
            </Dialog>

            {/* ============== Cancel Dialog ============== */}
            <Dialog open={openCancel} onOpenChange={setOpenCancel}>
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-none rounded-2xl p-0 sm:max-w-xl sm:rounded-3xl">
                    <ModalFrame
                        icon={Ban}
                        title="Cancel transfer"
                        description="Cancelling releases reserved bed and stops request."
                        footer={
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="outline" className="h-9 rounded-full" onClick={() => setOpenCancel(false)}>
                                    Close
                                </Button>
                                <Button className="h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={doCancel} disabled={loading}>
                                    Cancel transfer
                                </Button>
                            </div>
                        }
                    >
                        <div className="space-y-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Reason</div>
                            <Input className="h-10 rounded-2xl" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Optional cancel reason…" />
                        </div>
                    </ModalFrame>
                </DialogContent>
            </Dialog>
        </div>
    )
}
