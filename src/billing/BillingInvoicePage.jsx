// FILE: src/billing/BillingInvoicePage.jsx
import { useEffect, useMemo, useState } from "react";
import {
    createInvoice,
    getInvoice,
    updateInvoice,
    finalizeInvoice,
    cancelInvoice,
    addManualItem,
    addServiceItem,
    updateInvoiceItem,
    voidInvoiceItem,
    addPayment,
    deletePayment,
    listAdvances,
    applyAdvancesToInvoice,
    getBillingMasters,
    fetchInvoicePdf,
} from "../api/billing";
import { listPatients } from "../api/patients";

const BILLING_TYPES = [
    { value: "op_billing", label: "OP Billing" },
    { value: "ip_billing", label: "IP Billing" },
    { value: "pharmacy", label: "Pharmacy" },
    { value: "lab", label: "Laboratory" },
    { value: "radiology", label: "Radiology" },
    { value: "general", label: "General" },
];

const PAYMENT_MODES = [
    "cash",
    "card",
    "upi",
    "credit",
    "cheque",
    "neft",
    "rtgs",
    "wallet",
    "other",
];

export default function BillingInvoicePage({
    defaultBillingType = "op_billing",
    defaultContextType = "opd",
}) {
    const [patientQuery, setPatientQuery] = useState("");
    const [patientList, setPatientList] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);

    const [masters, setMasters] = useState({ doctors: [], credit_providers: [] });

    const [billingType, setBillingType] = useState(defaultBillingType);
    const [contextType, setContextType] = useState(defaultContextType);
    const [consultantId, setConsultantId] = useState("");
    const [providerId, setProviderId] = useState("");
    const [remarks, setRemarks] = useState("");

    const [invoiceIdInput, setInvoiceIdInput] = useState("");
    const [invoice, setInvoice] = useState(null);
    const [loadingInvoice, setLoadingInvoice] = useState(false);
    const [savingHeader, setSavingHeader] = useState(false);

    const [manualDesc, setManualDesc] = useState("");
    const [manualQty, setManualQty] = useState(1);
    const [manualPrice, setManualPrice] = useState("");
    const [manualTax, setManualTax] = useState("");

    const [serviceType, setServiceType] = useState("lab");
    const [serviceRefId, setServiceRefId] = useState("");
    const [serviceDesc, setServiceDesc] = useState("");
    const [servicePrice, setServicePrice] = useState("");
    const [serviceTax, setServiceTax] = useState("");

    const [payAmount, setPayAmount] = useState("");
    const [payMode, setPayMode] = useState("cash");
    const [payRef, setPayRef] = useState("");

    const [advances, setAdvances] = useState([]);
    const [advLoading, setAdvLoading] = useState(false);

    const totals = useMemo(() => {
        if (!invoice) return null;
        return {
            gross: Number(invoice.gross_total || 0),
            tax: Number(invoice.tax_total || 0),
            net: Number(invoice.net_total || 0),
            paid: Number(invoice.amount_paid || 0),
            balance: Number(invoice.balance_due || 0),
        };
    }, [invoice]);

    // ----- Load masters once -----
    useEffect(() => {
        const run = async () => {
            try {
                const { data } = await getBillingMasters();
                setMasters(data || { doctors: [], credit_providers: [] });
            } catch (err) {
                console.error(err);
            }
        };
        run();
    }, []);

    // ----- Patient search -----
    useEffect(() => {
        if (!patientQuery) {
            setPatientList([]);
            return;
        }
        const ctrl = new AbortController();
        const run = async () => {
            try {
                const { data } = await listPatients(patientQuery);
                setPatientList(data || []);
            } catch (err) {
                console.error(err);
            }
        };
        run();
        return () => ctrl.abort();
    }, [patientQuery]);

    const handleSelectPatient = (p) => {
        setSelectedPatient(p);
        setPatientQuery(`${p.first_name || ""} ${p.last_name || ""}`.trim());
    };

    // ----- Create / Load Invoice -----

    const handleCreateInvoice = async () => {
        if (!selectedPatient) {
            alert("Select a patient first");
            return;
        }
        try {
            setLoadingInvoice(true);
            const payload = {
                patient_id: selectedPatient.id,
                context_type: contextType,
                billing_type: billingType,
                consultant_id: consultantId || null,
                provider_id: providerId || null,
                remarks: remarks || null,
            };
            const { data } = await createInvoice(payload);
            setInvoice(data);
            setInvoiceIdInput(String(data.id));
        } catch (err) {
            console.error(err);
            alert("Create invoice failed");
        } finally {
            setLoadingInvoice(false);
        }
    };

    const handleLoadInvoice = async () => {
        if (!invoiceIdInput) return;
        try {
            setLoadingInvoice(true);
            const { data } = await getInvoice(Number(invoiceIdInput));
            setInvoice(data);
            // set header fields from invoice
            setBillingType(data.billing_type || defaultBillingType);
            setContextType(data.context_type || defaultContextType);
            setConsultantId(data.consultant_id || "");
            setProviderId(data.provider_id || "");
            setRemarks(data.remarks || "");
        } catch (err) {
            console.error(err);
            alert("Invoice not found");
        } finally {
            setLoadingInvoice(false);
        }
    };

    const handleSaveHeader = async () => {
        if (!invoice) return;
        try {
            setSavingHeader(true);
            const payload = {
                billing_type: billingType,
                consultant_id: consultantId || null,
                provider_id: providerId || null,
                visit_no: invoice.visit_no || null,
                remarks: remarks || null,
            };
            const { data } = await updateInvoice(invoice.id, payload);
            setInvoice(data);
        } catch (err) {
            console.error(err);
            alert("Failed to update header");
        } finally {
            setSavingHeader(false);
        }
    };

    const handleFinalize = async () => {
        if (!invoice) return;
        if (!window.confirm("Finalize this invoice? No further item edits allowed.")) return;
        try {
            const { data } = await finalizeInvoice(invoice.id);
            setInvoice(data);
            alert("Invoice finalized");
        } catch (err) {
            console.error(err);
            alert("Finalize failed");
        }
    };

    const handleCancel = async () => {
        if (!invoice) return;
        if (!window.confirm("Cancel this invoice?")) return;
        try {
            await cancelInvoice(invoice.id);
            alert("Invoice cancelled");
            setInvoice(null);
        } catch (err) {
            console.error(err);
            alert("Cancel failed");
        }
    };

    // ----- Items -----

    const handleAddManualItem = async () => {
        if (!invoice) {
            alert("Create or load an invoice first");
            return;
        }
        if (!manualDesc || !manualPrice) {
            alert("Description and price are required");
            return;
        }
        try {
            const payload = {
                description: manualDesc,
                quantity: Number(manualQty) || 1,
                unit_price: Number(manualPrice),
                tax_rate: Number(manualTax) || 0,
            };
            const { data } = await addManualItem(invoice.id, payload);
            setInvoice(data);
            setManualDesc("");
            setManualQty(1);
            setManualPrice("");
            setManualTax("");
        } catch (err) {
            console.error(err);
            alert("Failed to add manual item");
        }
    };

    const handleAddServiceItem = async () => {
        if (!invoice) {
            alert("Create or load an invoice first");
            return;
        }
        if (!serviceRefId) {
            alert("Service reference ID is required");
            return;
        }
        try {
            const payload = {
                service_type: serviceType,
                service_ref_id: Number(serviceRefId),
                description: serviceDesc || null,
                quantity: 1,
                unit_price: servicePrice ? Number(servicePrice) : undefined,
                tax_rate: serviceTax ? Number(serviceTax) : 0,
            };
            const { data } = await addServiceItem(invoice.id, payload);
            setInvoice(data);
            setServiceRefId("");
            setServiceDesc("");
            setServicePrice("");
            setServiceTax("");
        } catch (err) {
            console.error(err);
            alert("Failed to add service item");
        }
    };

    const handleUpdateLine = async (item, changes) => {
        if (!invoice) return;
        try {
            const { data } = await updateInvoiceItem(invoice.id, item.id, changes);
            setInvoice(data);
        } catch (err) {
            console.error(err);
            alert("Update line failed");
        }
    };

    const handleVoidLine = async (item) => {
        if (!invoice) return;
        if (!window.confirm("Void this line item?")) return;
        try {
            const { data } = await voidInvoiceItem(invoice.id, item.id, {
                reason: "Voided from UI",
            });
            setInvoice(data);
        } catch (err) {
            console.error(err);
            alert("Void line failed");
        }
    };

    // ----- Payments -----

    const handleAddPayment = async () => {
        if (!invoice) {
            alert("Create or load an invoice first");
            return;
        }
        if (!payAmount) {
            alert("Amount is required");
            return;
        }
        try {
            const payload = {
                amount: Number(payAmount),
                mode: payMode,
                reference_no: payRef || null,
            };
            const { data } = await addPayment(invoice.id, payload);
            setInvoice(data);
            setPayAmount("");
            setPayRef("");
        } catch (err) {
            console.error(err);
            alert("Failed to add payment");
        }
    };

    const handleDeletePayment = async (pay) => {
        if (!invoice) return;
        if (!window.confirm("Delete this payment?")) return;
        try {
            const { data } = await deletePayment(invoice.id, pay.id);
            setInvoice(data);
        } catch (err) {
            console.error(err);
            alert("Delete payment failed");
        }
    };

    // ----- Advances -----

    const loadAdvances = async () => {
        if (!invoice) return;
        setAdvLoading(true);
        try {
            const { data } = await listAdvances({
                patient_id: invoice.patient_id,
                only_with_balance: true,
            });
            setAdvances(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setAdvLoading(false);
        }
    };

    const handleApplyAdvances = async () => {
        if (!invoice) return;
        try {
            const { data } = await applyAdvancesToInvoice(invoice.id, {});
            setInvoice(data);
            alert("Advances applied");
            loadAdvances();
        } catch (err) {
            console.error(err);
            alert("Apply advances failed");
        }
    };

    // ----- Print -----

    const handlePrint = async () => {
        if (!invoice) return;
        try {
            const res = await fetchInvoicePdf(invoice.id);
            const blob = new Blob([res.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
        } catch (err) {
            console.error(err);
            alert("Failed to generate PDF");
        }
    };

    // ----- Render -----

    return (
        <div className="p-4 space-y-4">
            {/* Top bar: patient + invoice load/create */}
            <div className="bg-white border rounded-lg shadow-sm p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr] gap-3">
                    {/* Patient picker */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Patient
                        </label>
                        <input
                            value={patientQuery}
                            onChange={(e) => {
                                setPatientQuery(e.target.value);
                                setSelectedPatient(null);
                            }}
                            placeholder="Search by name / phone / UHID..."
                            className="w-full border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring focus:ring-indigo-200"
                        />
                        {patientList.length > 0 && !selectedPatient && (
                            <div className="mt-1 border rounded-md bg-white max-h-40 overflow-auto text-xs">
                                {patientList.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleSelectPatient(p)}
                                        className="w-full text-left px-2 py-1 hover:bg-indigo-50"
                                    >
                                        #{p.id} – {p.first_name} {p.last_name}{" "}
                                        {p.phone && <span className="text-gray-500">({p.phone})</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedPatient && (
                            <div className="mt-1 text-[11px] text-gray-600">
                                Selected: #{selectedPatient.id} – {selectedPatient.first_name}{" "}
                                {selectedPatient.last_name} {selectedPatient.phone && `(${selectedPatient.phone})`}
                            </div>
                        )}
                    </div>

                    {/* Billing type & context */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Billing Type
                        </label>
                        <select
                            value={billingType}
                            onChange={(e) => setBillingType(e.target.value)}
                            className="w-full border rounded-md px-2 py-1 text-sm"
                        >
                            {BILLING_TYPES.map((bt) => (
                                <option key={bt.value} value={bt.value}>
                                    {bt.label}
                                </option>
                            ))}
                        </select>
                        <label className="block text-xs font-semibold text-gray-700 mt-2 mb-1">
                            Context Type
                        </label>
                        <input
                            value={contextType}
                            onChange={(e) => setContextType(e.target.value)}
                            className="w-full border rounded-md px-2 py-1 text-sm"
                        />
                    </div>

                    {/* Invoice load / create */}
                    <div className="flex flex-col gap-2 justify-between">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Invoice ID
                            </label>
                            <div className="flex gap-2">
                                <input
                                    value={invoiceIdInput}
                                    onChange={(e) => setInvoiceIdInput(e.target.value)}
                                    className="flex-1 border rounded-md px-2 py-1 text-sm"
                                    placeholder="Enter ID & load"
                                />
                                <button
                                    type="button"
                                    onClick={handleLoadInvoice}
                                    className="px-3 py-1 text-xs rounded-md border bg-gray-50 hover:bg-gray-100"
                                >
                                    Load
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                            <button
                                type="button"
                                onClick={handleCreateInvoice}
                                disabled={loadingInvoice}
                                className="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {loadingInvoice ? "Creating..." : "New Invoice"}
                            </button>
                            {invoice && (
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="px-3 py-1 text-xs rounded-md border border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                                >
                                    Print
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Header + totals */}
            {invoice && (
                <div className="bg-white border rounded-lg shadow-sm p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1 text-xs">
                            <div className="font-semibold text-gray-800">
                                Invoice #{invoice.id}
                            </div>
                            <div className="text-gray-600">
                                Status:{" "}
                                <span className="font-semibold">{invoice.status}</span>
                            </div>
                            {invoice.invoice_number && (
                                <div className="text-gray-600">
                                    Invoice No: {invoice.invoice_number}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                            {totals && (
                                <>
                                    <span className="px-2 py-[2px] rounded-full bg-gray-100">
                                        Net: <strong>{totals.net.toFixed(2)}</strong>
                                    </span>
                                    <span className="px-2 py-[2px] rounded-full bg-green-50 text-green-700">
                                        Paid: <strong>{totals.paid.toFixed(2)}</strong>
                                    </span>
                                    <span className="px-2 py-[2px] rounded-full bg-red-50 text-red-700">
                                        Balance: <strong>{totals.balance.toFixed(2)}</strong>
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                            <button
                                type="button"
                                onClick={handleSaveHeader}
                                disabled={savingHeader}
                                className="px-3 py-1 rounded-md border text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                                {savingHeader ? "Saving..." : "Save Header"}
                            </button>
                            <button
                                type="button"
                                onClick={handleFinalize}
                                className="px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                Finalize
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>

                    {/* Header fields (consultant, credit provider, remarks) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                        <div>
                            <label className="block font-semibold text-gray-700 mb-1">
                                Consultant
                            </label>
                            <select
                                value={consultantId}
                                onChange={(e) => setConsultantId(e.target.value)}
                                className="w-full border rounded-md px-2 py-1 text-sm"
                            >
                                <option value="">— None —</option>
                                {(masters.doctors || []).map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name} ({d.email})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block font-semibold text-gray-700 mb-1">
                                Credit Provider (TPA / Insurance / Corporate)
                            </label>
                            <select
                                value={providerId}
                                onChange={(e) => setProviderId(e.target.value)}
                                className="w-full border rounded-md px-2 py-1 text-sm"
                            >
                                <option value="">— Self / Cash —</option>
                                {(masters.credit_providers || []).map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.code ? `${p.code} – ` : ""}
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block font-semibold text-gray-700 mb-1">
                                Remarks
                            </label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full border rounded-md px-2 py-1 text-sm h-16"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Items + payments grid */}
            {invoice && (
                <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
                    {/* Items block */}
                    <div className="bg-white border rounded-lg shadow-sm p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-800">
                                Bill Items
                            </h2>
                        </div>

                        <table className="w-full text-xs border-t">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-2 py-1 text-left">#</th>
                                    <th className="px-2 py-1 text-left">Description</th>
                                    <th className="px-2 py-1 text-right">Qty</th>
                                    <th className="px-2 py-1 text-right">Price</th>
                                    <th className="px-2 py-1 text-right">GST%</th>
                                    <th className="px-2 py-1 text-right">GST Amt</th>
                                    <th className="px-2 py-1 text-right">Total</th>
                                    <th className="px-2 py-1 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.length === 0 && (
                                    <tr>
                                        <td
                                            className="px-2 py-2 text-center text-gray-500"
                                            colSpan={8}
                                        >
                                            No items yet.
                                        </td>
                                    </tr>
                                )}
                                {invoice.items.map((it, idx) => (
                                    <tr
                                        key={it.id}
                                        className={it.is_voided ? "bg-red-50 text-gray-400" : ""}
                                    >
                                        <td className="px-2 py-1">{idx + 1}</td>
                                        <td className="px-2 py-1">{it.description}</td>
                                        <td className="px-2 py-1 text-right">
                                            <input
                                                type="number"
                                                min="1"
                                                value={it.quantity}
                                                onChange={(e) =>
                                                    handleUpdateLine(it, {
                                                        quantity: Number(e.target.value) || 1,
                                                    })
                                                }
                                                className="w-16 border rounded-md px-1 text-right"
                                                disabled={it.is_voided || invoice.status === "finalized"}
                                            />
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={it.unit_price}
                                                onChange={(e) =>
                                                    handleUpdateLine(it, {
                                                        unit_price: Number(e.target.value) || 0,
                                                    })
                                                }
                                                className="w-20 border rounded-md px-1 text-right"
                                                disabled={it.is_voided || invoice.status === "finalized"}
                                            />
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={it.tax_rate}
                                                onChange={(e) =>
                                                    handleUpdateLine(it, {
                                                        tax_rate: Number(e.target.value) || 0,
                                                    })
                                                }
                                                className="w-16 border rounded-md px-1 text-right"
                                                disabled={it.is_voided || invoice.status === "finalized"}
                                            />
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            {Number(it.tax_amount || 0).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            {Number(it.line_total || 0).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            {!it.is_voided && invoice.status !== "finalized" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleVoidLine(it)}
                                                    className="text-[11px] text-red-600 hover:underline"
                                                >
                                                    Void
                                                </button>
                                            )}
                                            {it.is_voided && (
                                                <span className="text-[11px] text-red-500">Voided</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Add manual item */}
                        <div className="mt-3 border-t pt-3 space-y-2 text-xs">
                            <div className="font-semibold text-gray-800">
                                Add Manual Item
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-[2fr,0.5fr,0.5fr,0.5fr,auto] gap-2">
                                <input
                                    value={manualDesc}
                                    onChange={(e) => setManualDesc(e.target.value)}
                                    placeholder="Description (e.g., Dressing charges)"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <input
                                    type="number"
                                    min="1"
                                    value={manualQty}
                                    onChange={(e) => setManualQty(e.target.value)}
                                    placeholder="Qty"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={manualPrice}
                                    onChange={(e) => setManualPrice(e.target.value)}
                                    placeholder="Unit Price"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <input
                                    type="number"
                                    step="0.1"
                                    value={manualTax}
                                    onChange={(e) => setManualTax(e.target.value)}
                                    placeholder="GST%"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddManualItem}
                                    className="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    Add Manual
                                </button>
                            </div>
                        </div>

                        {/* Add service item */}
                        <div className="mt-3 border-t pt-3 space-y-2 text-xs">
                            <div className="font-semibold text-gray-800">
                                Add Service Item
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,2fr,0.7fr,0.7fr,auto] gap-2">
                                <select
                                    value={serviceType}
                                    onChange={(e) => setServiceType(e.target.value)}
                                    className="border rounded-md px-2 py-1 text-sm"
                                >
                                    <option value="lab">Lab</option>
                                    <option value="radiology">Radiology</option>
                                    <option value="opd">OPD</option>
                                    <option value="ipd">IPD</option>
                                    <option value="pharmacy">Pharmacy</option>
                                    <option value="ot">OT</option>
                                    <option value="manual">Manual (with ref)</option>
                                    <option value="other">Other</option>
                                </select>
                                <input
                                    value={serviceRefId}
                                    onChange={(e) => setServiceRefId(e.target.value)}
                                    placeholder="Service Ref ID"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <input
                                    value={serviceDesc}
                                    onChange={(e) => setServiceDesc(e.target.value)}
                                    placeholder="Description (optional)"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={servicePrice}
                                    onChange={(e) => setServicePrice(e.target.value)}
                                    placeholder="Price"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <input
                                    type="number"
                                    step="0.1"
                                    value={serviceTax}
                                    onChange={(e) => setServiceTax(e.target.value)}
                                    placeholder="GST%"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddServiceItem}
                                    className="px-3 py-1 text-xs rounded-md bg-slate-700 text-white hover:bg-slate-800"
                                >
                                    Add Service
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Payments & advances */}
                    <div className="bg-white border rounded-lg shadow-sm p-3 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-800">
                                Payments
                            </h2>
                            <button
                                type="button"
                                onClick={loadAdvances}
                                className="px-2 py-1 rounded-md border text-[11px] hover:bg-gray-50"
                            >
                                Load Advances
                            </button>
                        </div>

                        <table className="w-full text-xs border-t">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-2 py-1 text-left">Mode</th>
                                    <th className="px-2 py-1 text-left">Ref</th>
                                    <th className="px-2 py-1 text-right">Amount</th>
                                    <th className="px-2 py-1 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.payments.length === 0 && (
                                    <tr>
                                        <td
                                            className="px-2 py-2 text-center text-gray-500"
                                            colSpan={4}
                                        >
                                            No payments yet.
                                        </td>
                                    </tr>
                                )}
                                {invoice.payments.map((p) => (
                                    <tr key={p.id}>
                                        <td className="px-2 py-1">{p.mode}</td>
                                        <td className="px-2 py-1">{p.reference_no || "—"}</td>
                                        <td className="px-2 py-1 text-right">
                                            {Number(p.amount || 0).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleDeletePayment(p)}
                                                className="text-[11px] text-red-600 hover:underline"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Add payment */}
                        <div className="border-t pt-3 space-y-2">
                            <div className="font-semibold text-gray-800">
                                Add Payment
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,2fr,auto] gap-2">
                                <select
                                    value={payMode}
                                    onChange={(e) => setPayMode(e.target.value)}
                                    className="border rounded-md px-2 py-1 text-sm"
                                >
                                    {PAYMENT_MODES.map((m) => (
                                        <option key={m} value={m}>
                                            {m.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="Amount"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <input
                                    value={payRef}
                                    onChange={(e) => setPayRef(e.target.value)}
                                    placeholder="Reference (optional)"
                                    className="border rounded-md px-2 py-1 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddPayment}
                                    className="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    Add Payment
                                </button>
                            </div>
                        </div>

                        {/* Advances view / apply */}
                        <div className="border-t pt-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="font-semibold text-gray-800">
                                    Patient Advances
                                </div>
                                <button
                                    type="button"
                                    onClick={handleApplyAdvances}
                                    className="px-3 py-1 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    Apply to Invoice
                                </button>
                            </div>
                            <div className="border rounded-md max-h-40 overflow-auto">
                                {advLoading && (
                                    <div className="px-2 py-2 text-center text-gray-500">
                                        Loading advances...
                                    </div>
                                )}
                                {!advLoading && advances.length === 0 && (
                                    <div className="px-2 py-2 text-center text-gray-500">
                                        No advances with balance.
                                    </div>
                                )}
                                {!advLoading &&
                                    advances.map((a) => (
                                        <div
                                            key={a.id}
                                            className="px-2 py-1 border-b last:border-b-0 flex justify-between text-[11px]"
                                        >
                                            <div>
                                                <div className="font-semibold">
                                                    ADV #{a.id} – {a.mode.toUpperCase()}
                                                </div>
                                                <div className="text-gray-600">
                                                    Amount: {Number(a.amount || 0).toFixed(2)} | Balance:{" "}
                                                    {Number(a.balance_remaining || 0).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
