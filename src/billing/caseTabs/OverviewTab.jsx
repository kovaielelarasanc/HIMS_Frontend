// FILE: src/billing/caseTabs/OverviewTab.jsx
import React from "react"
import { RefreshCcw, Filter } from "lucide-react"
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, cn, money } from "../_ui"
import { Info } from "./shared"

export default function OverviewTab({ loading, dashboard, caseRow, onReload }) {
    const particulars = dashboard?.particulars || []
    const totals = dashboard?.totals || {}

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
                <CardHeader
                    title="Overview"
                    subtitle="All available modules + totals (order wise)"
                    right={
                        <Button variant="outline" onClick={onReload} disabled={loading} className="gap-2">
                            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                            Reload
                        </Button>
                    }
                />
                <CardBody>
                    {loading ? (
                        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
                    ) : particulars.length === 0 ? (
                        <EmptyState title="No billing yet" desc="Add item lines to generate invoice totals per module." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[680px] text-left text-sm">
                                <thead className="text-xs font-extrabold text-slate-600">
                                    <tr className="border-b border-slate-100">
                                        <th className="py-3 pr-4">Order</th>
                                        <th className="py-3 pr-4">Module</th>
                                        <th className="py-3 pr-4">Label</th>
                                        <th className="py-3 pr-0 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {particulars.map((p, idx) => (
                                        <tr key={p.module || idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                                            <td className="py-3 pr-4 font-bold text-slate-700">#{idx + 1}</td>
                                            <td className="py-3 pr-4">
                                                <Badge tone="slate">{p.module}</Badge>
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700">{p.label}</td>
                                            <td className="py-3 pr-0 text-right font-extrabold text-slate-900">
                                                ₹ {money(p.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                        <Info label="Total Bill" value={`₹ ${money(totals.total_bill || 0)}`} />
                        <Info label="Payments Received" value={`₹ ${money(totals.payments_received || 0)}`} />
                        <Info label="Net Deposit" value={`₹ ${money(totals.net_deposit || 0)}`} />
                        <Info label="Balance" value={`₹ ${money(totals.balance || 0)}`} />
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Quick Info" subtitle="Bill type + referral snapshot" right={<Filter className="h-5 w-5 text-slate-400" />} />
                <CardBody className="space-y-3">
                    <Info label="Payer Mode" value={caseRow?.payer_mode || "SELF"} />
                    <Info label="Default Bill Type" value={caseRow?.default_payer_type || "—"} />
                    <Info label="Default Payer ID" value={caseRow?.default_payer_id ?? "—"} />
                    <Info label="Referral User ID" value={caseRow?.referral_user_id ?? "—"} />
                    <Info label="Referral Notes" value={caseRow?.referral_notes || "—"} />
                </CardBody>
            </Card>
        </div>
    )
}
