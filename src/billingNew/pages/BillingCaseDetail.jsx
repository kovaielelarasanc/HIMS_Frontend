// FILE: src/pages/billing/BillingCaseDetail.jsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, RefreshCcw } from "lucide-react"

import {
    getBillingCase,
    listCaseInvoices,
    listCasePayments,
    listCaseAdvances,
    isCanceledError,
} from "@/api/billings"
import { useCan } from "../hooks/useCan"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const cx = (...a) => a.filter(Boolean).join(" ")

function fmtDate(v) {
    if (!v) return "-"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString()
}

function fmtMoney(v) {
    if (v === null || v === undefined || v === "") return "-"
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n)
}

function statusBadge(status) {
    const s = String(status || "UNKNOWN").toUpperCase()
    const map = {
        DRAFT: "bg-muted text-foreground",
        OPEN: "bg-muted text-foreground",
        APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
        POSTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
        VOID: "bg-rose-50 text-rose-700 border-rose-200",
        CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
    }
    return cx("border", map[s] || "bg-muted text-foreground")
}

function normalizeCase(payload) {
    // Supports: { case: {...}, patient: {...} } or direct case object
    const c = payload?.case ?? payload ?? {}
    const patient =
        c?.patient ??
        payload?.patient ??
        payload?.patient_info ?? {
            name: c?.patient_name,
            uhid: c?.patient_uhid,
            phone: c?.patient_phone,
            sex: c?.patient_sex,
            age: c?.patient_age,
        }

    return {
        ...c,
        patient,
        posted_invoice_total: c?.posted_invoice_total ?? payload?.posted_invoice_total ?? 0,
        paid_total: c?.paid_total ?? payload?.paid_total ?? 0,
        balance: c?.balance ?? payload?.balance ?? 0,
    }
}

export default function BillingCaseDetail() {
    const { caseId } = useParams()
    const navigate = useNavigate()
    const can = useCan()

    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState("invoices")

    const [caseData, setCaseData] = useState(null)
    const [invoices, setInvoices] = useState([])
    const [payments, setPayments] = useState([])
    const [advances, setAdvances] = useState([])

    const computed = useMemo(() => {
        const posted = Number(caseData?.posted_invoice_total ?? 0)
        const paid = Number(caseData?.paid_total ?? 0)
        const balance =
            caseData?.balance !== undefined && caseData?.balance !== null
                ? Number(caseData?.balance ?? 0)
                : Math.max(0, posted - paid)

        return { posted, paid, balance }
    }, [caseData])

    const loadAll = async (signal) => {
        if (!can("billing.cases.view")) return
        setLoading(true)
        try {
            const [c, inv, pay, adv] = await Promise.all([
                getBillingCase(caseId, { signal }),
                listCaseInvoices(caseId, { signal }),
                listCasePayments(caseId, { signal }),
                listCaseAdvances(caseId, { signal }),
            ])

            setCaseData(normalizeCase(c))
            setInvoices(Array.isArray(inv) ? inv : inv?.items ?? inv?.results ?? [])
            setPayments(Array.isArray(pay) ? pay : pay?.items ?? pay?.results ?? [])
            setAdvances(Array.isArray(adv) ? adv : adv?.items ?? adv?.results ?? [])
        } catch (e) {
            if (isCanceledError(e)) return
            toast.error(e?.message || "Failed to load case detail")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        loadAll(controller.signal)
        return () => controller.abort()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    const patient = caseData?.patient || {}
    const caseStatus = String(caseData?.status || "-").toUpperCase()

    return (
        <div className="p-4 lg:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-2xl" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">
                            Case {caseData?.case_number ? `#${caseData.case_number}` : ""}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Encounter: {caseData?.encounter_type || "-"} · ID: {caseData?.encounter_id ?? "-"}
                        </p>
                    </div>
                </div>

                <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => {
                        const controller = new AbortController()
                        loadAll(controller.signal)
                    }}
                >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Header */}
            <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
                        <span>Case Header</span>
                        <Badge variant="outline" className={cx("rounded-xl", statusBadge(caseStatus))}>
                            {caseStatus}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-20 w-full rounded-2xl lg:col-span-4" />
                            ))}
                        </div>
                    ) : !can("billing.cases.view") ? (
                        <div className="text-sm text-muted-foreground">
                            You don’t have permission to view this case.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                            <Card className="rounded-2xl lg:col-span-5">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Patient</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    <div className="font-medium text-base">{patient?.name || "-"}</div>
                                    <div className="text-sm text-muted-foreground">
                                        UHID: {patient?.uhid || "-"} · Phone: {patient?.phone || "-"}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {patient?.age ? `Age: ${patient.age}` : "Age: -"} · {patient?.sex || "Sex: -"}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl lg:col-span-4">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Encounter + Payer</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">Encounter:</span>{" "}
                                        <span className="font-medium">{caseData?.encounter_type || "-"}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">Encounter ID:</span>{" "}
                                        <span className="font-medium">{caseData?.encounter_id ?? "-"}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">Payer Mode:</span>{" "}
                                        <span className="font-medium">{caseData?.payer_mode || "-"}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">Tariff Plan:</span>{" "}
                                        <span className="font-medium">{caseData?.tariff_plan_id ?? "-"}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl lg:col-span-3">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Totals</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Posted</span>
                                        <span className="font-medium">{fmtMoney(computed.posted)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Paid</span>
                                        <span className="font-medium">{fmtMoney(computed.paid)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Balance</span>
                                        <span className="font-semibold">{fmtMoney(computed.balance)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tabs */}
            <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs value={tab} onValueChange={setTab}>
                        <TabsList className="rounded-2xl">
                            <TabsTrigger value="invoices">Invoices</TabsTrigger>
                            <TabsTrigger value="payments">Payments</TabsTrigger>
                            <TabsTrigger value="advances">Advances</TabsTrigger>
                        </TabsList>

                        <TabsContent value="invoices" className="mt-4">
                            {loading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-full rounded-xl" />
                                    ))}
                                </div>
                            ) : invoices.length === 0 ? (
                                <div className="rounded-2xl border p-6 text-center">
                                    <div className="text-sm font-medium">No invoices</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Invoices from modules (LAB/RIS/PHARM/OT/OPD/IPD/MISC) will appear here.
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Invoice #</TableHead>
                                                <TableHead>Module</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Grand Total</TableHead>
                                                <TableHead>Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {invoices.map((inv) => (
                                                <TableRow
                                                    key={inv.id}
                                                    className="cursor-pointer hover:bg-muted/40"
                                                    onClick={() =>
                                                        navigate(`/billing/cases/${caseId}/invoices/${inv.id}`)
                                                    }
                                                >
                                                    <TableCell className="font-medium">
                                                        {inv.invoice_number || inv.number || inv.id}
                                                    </TableCell>
                                                    <TableCell>{inv.module || "-"}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={cx("rounded-xl", statusBadge(inv.status))}
                                                        >
                                                            {String(inv.status || "-").toUpperCase()}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {fmtMoney(inv.grand_total ?? inv.totals?.grand_total)}
                                                    </TableCell>
                                                    <TableCell>{fmtDate(inv.created_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="payments" className="mt-4">
                            {loading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-full rounded-xl" />
                                    ))}
                                </div>
                            ) : payments.length === 0 ? (
                                <div className="rounded-2xl border p-6 text-center">
                                    <div className="text-sm font-medium">No payments</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Payments recorded for this case will appear here.
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Mode</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Invoice</TableHead>
                                                <TableHead>Received At</TableHead>
                                                <TableHead>Received By</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payments.map((p) => (
                                                <TableRow key={p.id}>
                                                    <TableCell className="font-medium">{p.mode || "-"}</TableCell>
                                                    <TableCell className="text-right">{fmtMoney(p.amount)}</TableCell>
                                                    <TableCell>
                                                        {p.invoice_number || p.invoice?.invoice_number || p.invoice_id || "-"}
                                                    </TableCell>
                                                    <TableCell>{fmtDate(p.received_at)}</TableCell>
                                                    <TableCell>{p.received_by || p.received_by_user || "-"}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="advances" className="mt-4">
                            {loading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-full rounded-xl" />
                                    ))}
                                </div>
                            ) : advances.length === 0 ? (
                                <div className="rounded-2xl border p-6 text-center">
                                    <div className="text-sm font-medium">No advances</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Advances (deposit/adjustment) will appear here.
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Entry Type</TableHead>
                                                <TableHead>Advance Type</TableHead>
                                                <TableHead>Mode</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {advances.map((a) => (
                                                <TableRow key={a.id}>
                                                    <TableCell className="font-medium">{a.entry_type || "-"}</TableCell>
                                                    <TableCell>{a.advance_type || "-"}</TableCell>
                                                    <TableCell>{a.mode || "-"}</TableCell>
                                                    <TableCell className="text-right">{fmtMoney(a.amount)}</TableCell>
                                                    <TableCell>{fmtDate(a.created_at || a.received_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
