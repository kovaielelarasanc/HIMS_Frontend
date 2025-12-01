// FILE: src/billing/BillingListPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listInvoices, createInvoice } from "@/api/billing";
import { listPatients } from "@/api/patients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { IndianRupee, Filter, Search, User } from "lucide-react";

const TYPE_LABELS = {
    op_billing: "OP",
    ip_billing: "IP",
    pharmacy: "Pharmacy",
    lab: "Lab",
    radiology: "Radiology",
    general: "General",
};

export default function BillingListPage() {
    const [filterPatientId, setFilterPatientId] = useState("");
    const [filterType, setFilterType] = useState("");
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);

    // New OP billing dialog
    const [newDialogOpen, setNewDialogOpen] = useState(false);
    const [patientSearch, setPatientSearch] = useState("");
    const [patientResults, setPatientResults] = useState([]);
    const [patientLoading, setPatientLoading] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [creating, setCreating] = useState(false);

    const navigate = useNavigate();

    const loadInvoices = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filterPatientId) params.patient_id = Number(filterPatientId);
            if (filterType) params.billing_type = filterType;
            const { data } = await listInvoices(params);
            setInvoices(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInvoices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Patient search for New OP Billing ---

    const loadPatients = async (term) => {
        try {
            setPatientLoading(true);
            const { data } = await listPatients(term || "");
            setPatientResults(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setPatientLoading(false);
        }
    };

    useEffect(() => {
        if (!newDialogOpen) return;
        loadPatients(patientSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientSearch, newDialogOpen]);

    const handleCreateOpBilling = async () => {
        if (!selectedPatient) {
            alert("Please select a patient to create OP billing.");
            return;
        }
        try {
            setCreating(true);
            const payload = {
                patient_id: selectedPatient.id,
                context_type: "opd",
                context_id: null,
                // If your schema already supports billing_type this will be stored.
                billing_type: "op_billing",
            };
            const { data } = await createInvoice(payload);
            setNewDialogOpen(false);
            setSelectedPatient(null);
            setPatientSearch("");
            await loadInvoices();
            navigate(`/billing/op/${data.id}`);
        } catch (e) {
            console.error(e);
            alert("Failed to create OP billing invoice.");
        } finally {
            setCreating(false);
        }
    };

    const labelForType = (inv) => {
        const t = inv.billing_type || inv.context_type || "general";
        return TYPE_LABELS[t] || t;
    };

    const totalNet = invoices.reduce(
        (s, inv) => s + Number(inv.net_total || 0),
        0
    );
    const totalBalance = invoices.reduce(
        (s, inv) => s + Number(inv.balance_due || 0),
        0
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg font-semibold">Billing Invoices</h1>
                    <p className="text-xs text-muted-foreground">
                        OP / IP / Pharmacy / Lab / Radiology billing with finance overview.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden sm:flex flex-col items-end text-[11px] text-muted-foreground">
                        <span>
                            Total Net:{" "}
                            <span className="font-semibold">
                                ₹ {totalNet.toFixed(2)}
                            </span>
                        </span>
                        <span>
                            Total Outstanding:{" "}
                            <span className="font-semibold text-red-500">
                                ₹ {totalBalance.toFixed(2)}
                            </span>
                        </span>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => setNewDialogOpen(true)}
                    >
                        New OP Billing
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                        <label className="text-[11px] mb-1 block">Patient ID</label>
                        <Input
                            value={filterPatientId}
                            onChange={(e) => setFilterPatientId(e.target.value)}
                            placeholder="e.g., 101"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] mb-1 block">Billing Type</label>
                        <select
                            className="w-full border rounded-md h-9 px-2 text-xs bg-background"
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
                    <div className="flex items-end gap-2">
                        <Button type="button" size="sm" onClick={loadInvoices} disabled={loading}>
                            {loading ? "Loading..." : "Apply"}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setFilterPatientId("");
                                setFilterType("");
                                loadInvoices();
                            }}
                        >
                            Reset
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* List */}
            <Card>
                <CardContent className="pt-4">
                    <div className="text-[11px] text-muted-foreground mb-2">
                        {loading
                            ? "Loading invoices..."
                            : `Showing ${invoices.length} invoice(s)`}
                    </div>
                    <div className="border rounded-lg overflow-hidden text-[11px]">
                        <div className="grid grid-cols-10 bg-muted px-3 py-2 font-medium">
                            <div className="col-span-1">ID</div>
                            <div className="col-span-2">Invoice No</div>
                            <div className="col-span-1">Patient</div>
                            <div className="col-span-1">Type</div>
                            <div className="col-span-2 text-right">Net Amount</div>
                            <div className="col-span-1 text-right">Paid</div>
                            <div className="col-span-1 text-right">Balance</div>
                            <div className="col-span-1 text-right">Action</div>
                        </div>
                        {invoices.map((inv) => (
                            <div
                                key={inv.id}
                                className="grid grid-cols-10 px-3 py-2 border-t hover:bg-muted/40"
                            >
                                <div className="col-span-1">{inv.id}</div>
                                <div className="col-span-2">
                                    {inv.invoice_number || inv.id}
                                </div>
                                <div className="col-span-1">{inv.patient_id}</div>
                                <div className="col-span-1">
                                    <Badge variant="outline">
                                        {labelForType(inv)}
                                    </Badge>
                                </div>
                                <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                    <IndianRupee className="w-3 h-3" />
                                    {Number(inv.net_total || 0).toFixed(2)}
                                </div>
                                <div className="col-span-1 text-right">
                                    {Number(inv.amount_paid || 0).toFixed(2)}
                                </div>
                                <div className="col-span-1 text-right">
                                    {Number(inv.balance_due || 0).toFixed(2)}
                                </div>
                                <div className="col-span-1 text-right">
                                    <Button
                                        type="button"
                                        size="xs"
                                        variant="outline"
                                        onClick={() =>
                                            navigate(
                                                `/billing/${(inv.billing_type ||
                                                    inv.context_type ||
                                                    "general"
                                                ).replace("_billing", "")}/${inv.id}`
                                            )
                                        }
                                    >
                                        Open
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {!loading && invoices.length === 0 && (
                            <div className="px-3 py-4 text-center text-muted-foreground">
                                No invoices found.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* New OP Billing Dialog */}
            <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            New OP Billing – Select Patient
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-1">
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-muted-foreground" />
                            <Input
                                value={patientSearch}
                                onChange={(e) => setPatientSearch(e.target.value)}
                                placeholder="Search by name, UHID, phone..."
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="border rounded-md max-h-56 overflow-auto text-xs">
                            {patientLoading && (
                                <div className="px-3 py-2 text-muted-foreground">
                                    Loading patients...
                                </div>
                            )}
                            {!patientLoading &&
                                patientResults.map((p) => {
                                    const isActive = selectedPatient?.id === p.id;
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setSelectedPatient(p)}
                                            className={[
                                                "w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted focus:outline-none border-b last:border-b-0",
                                                isActive ? "bg-blue-50" : "",
                                            ].join(" ")}
                                        >
                                            <User className="w-3 h-3 text-muted-foreground" />
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-medium">
                                                    {p.first_name} {p.last_name || ""}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    UHID: {p.uhid} · ID: {p.id} · {p.phone || "No phone"}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            {!patientLoading && patientResults.length === 0 && (
                                <div className="px-3 py-2 text-muted-foreground">
                                    No patients found.
                                </div>
                            )}
                        </div>
                        {selectedPatient && (
                            <div className="text-[11px] text-muted-foreground">
                                Selected:{" "}
                                <span className="font-semibold">
                                    {selectedPatient.first_name} {selectedPatient.last_name || ""}{" "}
                                </span>
                                (UHID: {selectedPatient.uhid}, ID: {selectedPatient.id})
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setNewDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateOpBilling}
                            disabled={creating}
                        >
                            {creating ? "Creating..." : "Create OP Bill"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
