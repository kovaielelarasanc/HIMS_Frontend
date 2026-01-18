// FILE: src/billing/caseTabs/InvoiceSummaryTab.jsx
import React, { useState } from "react"
import { Filter, Search } from "lucide-react"
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, money } from "../_ui"
import { GROUP_BY, INVOICE_STATUSES, fmtDate } from "./shared"

export default function InvoiceSummaryTab({ loading, data, onFetch, onOpenInvoice }) {
    const [filters, setFilters] = useState({
        group_by: "module",
        module: "",
        status: "",
        service_group: "",
        q: "",
        from_date: "",
        to_date: "",
        is_manual: "",
        min_net: "",
        max_net: "",
    })

    const groups = data?.groups || []
    const netTotal = data?.totals?.net_total ?? "0"

    function apply() {
        onFetch({
            group_by: filters.group_by,
            module: filters.module,
            status: filters.status,
            service_group: filters.service_group,
            q: filters.q,
            from_date: filters.from_date,
            to_date: filters.to_date,
            is_manual: filters.is_manual === "" ? undefined : filters.is_manual === "true",
            min_net: filters.min_net || undefined,
            max_net: filters.max_net || undefined,
        })
    }

    function reset() {
        const x = {
            group_by: "module",
            module: "",
            status: "",
            service_group: "",
            q: "",
            from_date: "",
            to_date: "",
            is_manual: "",
            min_net: "",
            max_net: "",
        }
        setFilters(x)
        onFetch({ group_by: "module" })
    }

    return (
        <Card>
            <CardHeader
                title="Invoice Summary"
                subtitle="All invoice lines grouped with full details + extreme filters"
                right={
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">Net Total: ₹ {money(netTotal)}</Badge>
                        <Button variant="outline" onClick={reset}>Reset</Button>
                        <Button onClick={apply} className="gap-2">
                            <Filter className="h-4 w-4" />
                            Apply
                        </Button>
                    </div>
                }
            />
            <CardBody>
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <Field label="Group By">
                        <Select value={filters.group_by} onChange={(e) => setFilters({ ...filters, group_by: e.target.value })}>
                            {GROUP_BY.map((g) => (
                                <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Module">
                        <Input
                            placeholder="Ex: LAB / ROOM / PHM"
                            value={filters.module}
                            onChange={(e) => setFilters({ ...filters, module: e.target.value.toUpperCase() })}
                        />
                    </Field>

                    <Field label="Invoice Status">
                        <Select
                            value={filters.status || "ALL"}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value === "ALL" ? "" : e.target.value })}
                        >
                            {INVOICE_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Search (Item/Code)">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                className="pl-9"
                                placeholder="paracetamol / CBC / bed"
                                value={filters.q}
                                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                            />
                        </div>
                    </Field>

                    <Field label="From Date">
                        <Input type="date" value={filters.from_date} onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} />
                    </Field>

                    <Field label="To Date">
                        <Input type="date" value={filters.to_date} onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} />
                    </Field>

                    <Field label="Manual?">
                        <Select value={filters.is_manual} onChange={(e) => setFilters({ ...filters, is_manual: e.target.value })}>
                            <option value="">ALL</option>
                            <option value="true">Manual</option>
                            <option value="false">Auto</option>
                        </Select>
                    </Field>

                    <Field label="Min Net">
                        <Input inputMode="decimal" placeholder="0" value={filters.min_net} onChange={(e) => setFilters({ ...filters, min_net: e.target.value })} />
                    </Field>

                    <Field label="Max Net">
                        <Input inputMode="decimal" placeholder="0" value={filters.max_net} onChange={(e) => setFilters({ ...filters, max_net: e.target.value })} />
                    </Field>

                    <Field label="Service Group (optional)">
                        <Input
                            placeholder="Ex: LAB / PHARMACY / ROOM"
                            value={filters.service_group}
                            onChange={(e) => setFilters({ ...filters, service_group: e.target.value.toUpperCase() })}
                        />
                    </Field>
                </div>

                {loading ? (
                    <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
                ) : groups.length === 0 ? (
                    <EmptyState title="No invoice lines" desc="No items match your filters. Try reset." />
                ) : (
                    <div className="space-y-3">
                        {groups.map((g) => (
                            <div key={g.key} className="rounded-2xl border border-slate-100 bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Badge tone="slate">{g.label}</Badge>
                                        <Badge tone="blue">{g.count} items</Badge>
                                    </div>
                                    <div className="text-sm font-extrabold text-slate-900">₹ {money(g.total)}</div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[980px] text-left text-sm">
                                        <thead className="text-xs font-extrabold text-slate-600">
                                            <tr className="border-b border-slate-100">
                                                <th className="py-3 px-4">Item</th>
                                                <th className="py-3 pr-4">Qty</th>
                                                <th className="py-3 pr-4">Rate</th>
                                                <th className="py-3 pr-4">Dis</th>
                                                <th className="py-3 pr-4">GST%</th>
                                                <th className="py-3 pr-4">Tax</th>
                                                <th className="py-3 pr-4">Net</th>
                                                <th className="py-3 pr-4">Invoice</th>
                                                <th className="py-3 pr-4">Status</th>
                                                <th className="py-3 pr-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(g.items || []).map((it) => (
                                                <tr key={it.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                                    <td className="py-3 px-4">
                                                        <div className="font-extrabold text-slate-900">{it.description || "—"}</div>
                                                        <div className="text-xs text-slate-500">
                                                            {it.item_code ? `Code: ${it.item_code}` : "—"} · {it.service_date ? fmtDate(it.service_date) : "—"} · {it.module || "—"}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 pr-4">{it.qty}</td>
                                                    <td className="py-3 pr-4">₹ {money(it.unit_price)}</td>
                                                    <td className="py-3 pr-4">₹ {money(it.discount_amount)}</td>
                                                    <td className="py-3 pr-4">{it.gst_rate}</td>
                                                    <td className="py-3 pr-4">₹ {money(it.tax_amount)}</td>
                                                    <td className="py-3 pr-4 font-extrabold text-slate-900">₹ {money(it.net_amount)}</td>
                                                    <td className="py-3 pr-4">{it.invoice_number || `#${it.invoice_id}`}</td>
                                                    <td className="py-3 pr-4">{it.invoice_status}</td>
                                                    <td className="py-3 pr-4 text-right">
                                                        <Button variant="outline" onClick={() => onOpenInvoice(it.invoice_id)}>Open</Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardBody>
        </Card>
    )
}
