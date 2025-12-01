// FILE: src/emr/PatientBillingTab.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getPatientBillingSummary,
    fetchPatientBillingSummaryBlob,
} from "@/api/billing";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { IndianRupee, Download, Printer, ArrowUpRight } from "lucide-react";

const TYPE_LABELS = {
    op_billing: "OP",
    ip_billing: "IP",
    pharmacy: "Pharmacy",
    lab: "Lab",
    radiology: "Radiology",
    general: "General",
    opd: "OP",
    ipd: "IP",
};

const STATUS_COLORS = {
    draft: "bg-amber-50 text-amber-700 border-amber-100",
    finalized: "bg-emerald-50 text-emerald-700 border-emerald-100",
    cancelled: "bg-red-50 text-red-700 border-red-100",
};

export default function PatientBillingTab({ patientId }) {
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [printLoading, setPrintLoading] = useState(false);
    const [filterType, setFilterType] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [search, setSearch] = useState("");

    const load = async () => {
        if (!patientId) return;
        try {
            setLoading(true);
            const { data } = await getPatientBillingSummary(patientId);
            setSummary(data || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId]);

    const patient = summary?.patient;
    const totals = summary?.totals || {
        net_total: 0,
        amount_paid: 0,
        balance_due: 0,
        advances_total: 0,
    };
    const invoices = summary?.invoices || [];
    const advances = summary?.advances || [];

    const advanceTotal = useMemo(
        () =>
            (advances || []).reduce(
                (sum, a) => sum + Number(a.balance_remaining || 0),
                0
            ),
        [advances]
    );

    const filteredInvoices = useMemo(() => {
        return invoices.filter((inv) => {
            const typeVal = inv.billing_type || inv.context_type || "general";
            if (filterType && typeVal !== filterType) return false;
            if (filterStatus && inv.status !== filterStatus) return false;
            if (search) {
                const term = search.toLowerCase();
                const invNo = `${inv.invoice_number || inv.id}`.toLowerCase();
                const ctx = `${typeVal}`.toLowerCase();
                if (!invNo.includes(term) && !ctx.includes(term)) return false;
            }
            return true;
        });
    }, [invoices, filterType, filterStatus, search]);

    const handlePrintSummary = async () => {
        if (!patientId) return;
        try {
            setPrintLoading(true);
            const res = await fetchPatientBillingSummaryBlob(patientId);
            const blob = new Blob([res.data], {
                type: res.headers["content-type"] || "application/pdf",
            });
            const url = window.URL.createObjectURL(blob);
            const w = window.open(url);
            if (!w) {
                const a = document.createElement("a");
                a.href = url;
                a.download = `patient-${patientId}-billing-summary.pdf`;
                a.click();
            }
        } catch (err) {
            console.error(err);
            alert("Failed to open summary for print.");
        } finally {
            setPrintLoading(false);
        }
    };

    const handleDownloadSummary = async () => {
        if (!patientId) return;
        try {
            setPrintLoading(true);
            const res = await fetchPatientBillingSummaryBlob(patientId);
            const blob = new Blob([res.data], {
                type: res.headers["content-type"] || "application/pdf",
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `patient-${patientId}-billing-summary.pdf`;
            a.click();
        } catch (err) {
            console.error(err);
            alert("Failed to download summary.");
        } finally {
            setPrintLoading(false);
        }
    };

    const labelForType = (inv) => {
        const t = inv.billing_type || inv.context_type || "general";
        return TYPE_LABELS[t] || t;
    };

    if (!patientId) {
        return (
            <div className="p-4 text-xs text-muted-foreground">
                No patient selected. Open a patient to view billing.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold">Billing & Finance</h2>
                    {patient && (
                        <p className="text-[11px] text-muted-foreground">
                            Patient:{" "}
                            <span className="font-medium">
                                {patient.name || `#${patient.id}`}
                            </span>{" "}
                            · UHID: {patient.uhid || "—"} · ID: {patient.id}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("/billing")}
                    >
                        Go to Billing Console
                        <ArrowUpRight className="w-3 h-3 ml-1" />
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handlePrintSummary}
                        disabled={printLoading}
                    >
                        <Printer className="w-4 h-4 mr-1" />
                        Print
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleDownloadSummary}
                        disabled={printLoading}
                    >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                    </Button>
                </div>
            </div>

            {/* Snapshot cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <Card className="border-blue-100">
                    <CardContent className="py-3 px-3">
                        <div className="text-[10px] text-muted-foreground">Total Billed</div>
                        <div className="mt-1 flex items-center gap-1 text-sm font-semibold">
                            <IndianRupee className="w-3 h-3" />
                            {Number(totals.net_total || 0).toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-emerald-100">
                    <CardContent className="py-3 px-3">
                        <div className="text-[10px] text-muted-foreground">Total Received</div>
                        <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-emerald-700">
                            <IndianRupee className="w-3 h-3" />
                            {Number(totals.amount_paid || 0).toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-red-100">
                    <CardContent className="py-3 px-3">
                        <div className="text-[10px] text-muted-foreground">
                            Total Outstanding
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-red-600">
                            <IndianRupee className="w-3 h-3" />
                            {Number(totals.balance_due || 0).toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-amber-100">
                    <CardContent className="py-3 px-3">
                        <div className="text-[10px] text-muted-foreground">
                            Available Advances
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-sm font-semibold">
                            <IndianRupee className="w-3 h-3" />
                            {advanceTotal.toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Invoices filter + table */}
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-sm">Invoices</CardTitle>
                    <div className="text-[11px] text-muted-foreground">
                        {loading
                            ? "Loading invoices…"
                            : `Showing ${filteredInvoices.length} of ${invoices.length} invoice(s)`}
                    </div>
                </CardHeader>
                <CardContent className="pt-2 space-y-3 text-[11px]">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                        <div>
                            <label className="block mb-1 text-[10px]">Billing Type</label>
                            <select
                                className="w-full h-8 border rounded-md px-2 bg-background"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                            >
                                <option value="">All</option>
                                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                                    <option key={val} value={val}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-[10px]">Status</label>
                            <select
                                className="w-full h-8 border rounded-md px-2 bg-background"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="">All</option>
                                <option value="draft">Draft</option>
                                <option value="finalized">Finalized</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-[10px]">
                                Search (Invoice no / type)
                            </label>
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="e.g., 102 or OP"
                                className="h-8 text-[11px]"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setFilterType("");
                                    setFilterStatus("");
                                    setSearch("");
                                }}
                            >
                                Reset
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={load}
                            >
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-10 bg-muted px-3 py-2 font-medium">
                            <div className="col-span-1">ID</div>
                            <div className="col-span-2">Invoice No</div>
                            <div className="col-span-1">Type</div>
                            <div className="col-span-2 text-right">Net</div>
                            <div className="col-span-1 text-right">Paid</div>
                            <div className="col-span-1 text-right">Balance</div>
                            <div className="col-span-1">Status</div>
                            <div className="col-span-1 text-right">Action</div>
                        </div>
                        {filteredInvoices.map((inv) => {
                            const t = inv.billing_type || inv.context_type || "general";
                            const status = inv.status || "draft";
                            const statusCls =
                                STATUS_COLORS[status] || "bg-slate-50 text-slate-700";

                            return (
                                <div
                                    key={inv.id}
                                    className="grid grid-cols-10 px-3 py-2 border-t hover:bg-muted/40"
                                >
                                    <div className="col-span-1">{inv.id}</div>
                                    <div className="col-span-2">
                                        {inv.invoice_number || inv.id}
                                    </div>
                                    <div className="col-span-1">
                                        <Badge variant="outline">{labelForType(inv)}</Badge>
                                    </div>
                                    <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                        <IndianRupee className="w-3 h-3" />
                                        {Number(inv.net_total || 0).toFixed(2)}
                                    </div>
                                    <div className="col-span-1 text-right">
                                        {Number(inv.amount_paid || 0).toFixed(2)}
                                    </div>
                                    <div
                                        className={`col-span-1 text-right ${Number(inv.balance_due || 0) > 0
                                                ? "text-red-600 font-medium"
                                                : ""
                                            }`}
                                    >
                                        {Number(inv.balance_due || 0).toFixed(2)}
                                    </div>
                                    <div className="col-span-1">
                                        <span
                                            className={
                                                "inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] " +
                                                statusCls
                                            }
                                        >
                                            {status}
                                        </span>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <Button
                                            type="button"
                                            size="xs"
                                            variant="outline"
                                            onClick={() =>
                                                navigate(
                                                    `/billing/${t.replace("_billing", "")}/${inv.id}`
                                                )
                                            }
                                        >
                                            Open
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                        {!loading && filteredInvoices.length === 0 && (
                            <div className="px-3 py-4 text-center text-muted-foreground">
                                No invoices found.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
