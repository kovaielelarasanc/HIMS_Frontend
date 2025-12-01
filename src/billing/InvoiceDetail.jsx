// FILE: src/billing/InvoiceDetail.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getInvoice,
    updateInvoice,
    addManualItem,
    addServiceItem, // reserved for future
    updateItem,
    voidItem,
    addPayment,
    deletePayment,
    applyAdvancesToInvoice,
    finalizeInvoice,
    cancelInvoice,
    getBillingMasters,
    fetchInvoicePdf,
    getPatientBillingSummary,
    fetchPatientSummaryPdf,
} from "../api/billing";

function formatMoney(x) {
    const n = Number(x || 0);
    return n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function InvoiceDetail() {
    const { invoiceId } = useParams();
    const navigate = useNavigate();

    const [invoice, setInvoice] = useState(null);
    const [masters, setMasters] = useState({
        doctors: [],
        credit_providers: [],
        packages: [],
        payers: [],
        tpas: [],
        credit_plans: [],
    });
    const [loading, setLoading] = useState(true);
    const [savingHeader, setSavingHeader] = useState(false);
    const [headerForm, setHeaderForm] = useState({});
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualForm, setManualForm] = useState({
        description: "",
        quantity: 1,
        unit_price: "",
        tax_rate: 0,
        discount_percent: 0,
        discount_amount: "",
    });
    const [editingItemId, setEditingItemId] = useState(null);
    const [itemForm, setItemForm] = useState({
        description: "",
        quantity: 1,
        unit_price: "",
        tax_rate: 0,
        discount_percent: 0,
        discount_amount: "",
    });
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        mode: "cash",
        reference_no: "",
        notes: "",
    });
    const [isRefund, setIsRefund] = useState(false);

    const [busyAction, setBusyAction] = useState(""); // "finalize", "cancel", "advance", ...
    const [error, setError] = useState("");

    const [patientSummary, setPatientSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    const isFinalized =
        invoice?.status === "finalized" || invoice?.status === "cancelled";

    useEffect(() => {
        loadMasters();
    }, []);

    useEffect(() => {
        if (invoiceId) {
            loadInvoice();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoiceId]);

    async function loadMasters() {
        try {
            const { data } = await getBillingMasters();
            setMasters({
                doctors: data?.doctors || [],
                credit_providers: data?.credit_providers || [],
                packages: data?.packages || [],
                payers: data?.payers || [],
                tpas: data?.tpas || [],
                credit_plans: data?.credit_plans || [],
            });
        } catch (err) {
            console.error("Failed to load masters", err);
        }
    }

    async function loadPatientSummary(patientId) {
        if (!patientId) return;
        setLoadingSummary(true);
        try {
            const { data } = await getPatientBillingSummary(patientId);
            setPatientSummary(data);
        } catch (err) {
            console.error("Failed to load patient billing summary", err);
        } finally {
            setLoadingSummary(false);
        }
    }

    async function loadInvoice() {
        setLoading(true);
        setError("");
        try {
            const { data } = await getInvoice(invoiceId);
            setInvoice(data);
            setHeaderForm({
                billing_type: data.billing_type || "general",
                consultant_id: data.consultant_id || "",
                provider_id: data.provider_id || "",
                visit_no: data.visit_no || "",
                remarks: data.remarks || "",
                header_discount_percent: data.header_discount_percent ?? "",
                header_discount_amount: data.header_discount_amount ?? "",
                discount_remarks: data.discount_remarks || "",
            });
            await loadPatientSummary(data.patient_id);
        } catch (err) {
            console.error("Failed to load invoice", err);
            setError("Unable to load invoice. Please go back and try again.");
        } finally {
            setLoading(false);
        }
    }

    function onHeaderChange(e) {
        const { name, value } = e.target;
        setHeaderForm((prev) => ({ ...prev, [name]: value }));
    }

    async function handleSaveHeader() {
        if (!invoice) return;
        setSavingHeader(true);
        setError("");
        try {
            const payload = {
                billing_type: headerForm.billing_type || null,
                consultant_id: headerForm.consultant_id
                    ? Number(headerForm.consultant_id)
                    : null,
                provider_id: headerForm.provider_id
                    ? Number(headerForm.provider_id)
                    : null,
                visit_no: headerForm.visit_no || null,
                remarks: headerForm.remarks || null,
                header_discount_percent:
                    headerForm.header_discount_percent !== "" &&
                        headerForm.header_discount_percent !== null
                        ? Number(headerForm.header_discount_percent)
                        : null,
                header_discount_amount:
                    headerForm.header_discount_amount !== "" &&
                        headerForm.header_discount_amount !== null
                        ? Number(headerForm.header_discount_amount)
                        : null,
                discount_remarks: headerForm.discount_remarks || null,
            };
            const { data } = await updateInvoice(invoice.id, payload);
            setInvoice(data);
            // refresh discount values from server
            setHeaderForm((prev) => ({
                ...prev,
                header_discount_percent: data.header_discount_percent ?? "",
                header_discount_amount: data.header_discount_amount ?? "",
            }));
        } catch (err) {
            console.error("Save header failed", err);
            setError("Unable to save header details.");
        } finally {
            setSavingHeader(false);
        }
    }

    function onManualChange(e) {
        const { name, value } = e.target;
        setManualForm((prev) => ({
            ...prev,
            [name]:
                name === "quantity" || name === "tax_rate" || name === "discount_percent"
                    ? Number(value)
                    : value,
        }));
    }

    async function handleAddManualItem(e) {
        e.preventDefault();
        if (!invoice) return;
        setError("");
        try {
            const payload = {
                description: manualForm.description || "",
                quantity: manualForm.quantity || 1,
                unit_price: Number(manualForm.unit_price || 0),
                tax_rate: Number(manualForm.tax_rate || 0),
                discount_percent: Number(manualForm.discount_percent || 0),
                discount_amount:
                    manualForm.discount_amount !== ""
                        ? Number(manualForm.discount_amount || 0)
                        : undefined,
            };
            const { data } = await addManualItem(invoice.id, payload);
            setInvoice(data);
            setShowManualForm(false);
            setManualForm({
                description: "",
                quantity: 1,
                unit_price: "",
                tax_rate: 0,
                discount_percent: 0,
                discount_amount: "",
            });
        } catch (err) {
            console.error("Add manual item failed", err);
            setError("Unable to add manual item. Please check values.");
        }
    }

    function startEditItem(it) {
        setEditingItemId(it.id);
        setItemForm({
            description: it.description || "",
            quantity: it.quantity || 1,
            unit_price: String(it.unit_price || ""),
            tax_rate: Number(it.tax_rate || 0),
            discount_percent: Number(it.discount_percent || 0),
            discount_amount:
                it.discount_amount !== null && it.discount_amount !== undefined
                    ? String(it.discount_amount)
                    : "",
        });
    }

    function onItemChange(e) {
        const { name, value } = e.target;
        setItemForm((prev) => ({
            ...prev,
            [name]:
                name === "quantity" || name === "tax_rate" || name === "discount_percent"
                    ? Number(value)
                    : value,
        }));
    }

    async function handleUpdateItem(e) {
        e.preventDefault();
        if (!invoice || !editingItemId) return;
        try {
            const payload = {
                description: itemForm.description || "",
                quantity: itemForm.quantity || 1,
                unit_price: Number(itemForm.unit_price || 0),
                tax_rate: Number(itemForm.tax_rate || 0),
                discount_percent: Number(itemForm.discount_percent || 0),
                discount_amount:
                    itemForm.discount_amount !== ""
                        ? Number(itemForm.discount_amount || 0)
                        : undefined,
            };
            const { data } = await updateItem(invoice.id, editingItemId, payload);
            setInvoice(data);
            setEditingItemId(null);
        } catch (err) {
            console.error("Update item failed", err);
            setError("Unable to update item.");
        }
    }

    async function handleVoidItem(it) {
        if (!invoice) return;
        const ok = window.confirm("Void this line item?");
        if (!ok) return;
        try {
            const { data } = await voidItem(invoice.id, it.id, {
                reason: "Voided from UI",
            });
            setInvoice(data);
        } catch (err) {
            console.error("Void item failed", err);
            setError("Unable to void item.");
        }
    }

    function onPaymentChange(e) {
        const { name, value } = e.target;
        setPaymentForm((prev) => ({ ...prev, [name]: value }));
    }

    async function handleAddPayment(e) {
        e.preventDefault();
        if (!invoice) return;
        setError("");
        try {
            let amount = Number(paymentForm.amount || 0);
            if (isRefund) {
                amount = -Math.abs(amount); // refund = negative
            }

            const payload = {
                amount,
                mode: isRefund ? "refund" : paymentForm.mode,
                reference_no: paymentForm.reference_no || null,
                notes: paymentForm.notes || null,
            };

            const { data } = await addPayment(invoice.id, payload);
            setInvoice(data);
            setShowPaymentForm(false);
            setIsRefund(false);
            setPaymentForm({
                amount: "",
                mode: "cash",
                reference_no: "",
                notes: "",
            });
        } catch (err) {
            console.error("Add payment/refund failed", err);
            setError("Unable to save payment / refund.");
        }
    }

    async function handleDeletePayment(pay) {
        if (!invoice) return;
        const ok = window.confirm("Delete this payment?");
        if (!ok) return;
        try {
            const { data } = await deletePayment(invoice.id, pay.id);
            setInvoice(data);
        } catch (err) {
            console.error("Delete payment failed", err);
            setError("Unable to delete payment.");
        }
    }

    async function handleApplyAdvances() {
        if (!invoice) return;
        setBusyAction("advance");
        setError("");
        try {
            const { data } = await applyAdvancesToInvoice(invoice.id, {});
            setInvoice(data);
        } catch (err) {
            console.error("Apply advances failed", err);
            setError("Unable to apply advances.");
        } finally {
            setBusyAction("");
        }
    }

    async function handleFinalize() {
        if (!invoice) return;
        const ok = window.confirm(
            "Finalize this invoice? You cannot edit items later."
        );
        if (!ok) return;
        setBusyAction("finalize");
        setError("");
        try {
            const { data } = await finalizeInvoice(invoice.id);
            setInvoice(data);
        } catch (err) {
            console.error("Finalize failed", err);
            setError("Unable to finalize invoice.");
        } finally {
            setBusyAction("");
        }
    }

    async function handleCancel() {
        if (!invoice) return;
        const ok = window.confirm("Cancel this invoice?");
        if (!ok) return;
        setBusyAction("cancel");
        setError("");
        try {
            await cancelInvoice(invoice.id);
            await loadInvoice();
        } catch (err) {
            console.error("Cancel failed", err);
            setError("Unable to cancel invoice.");
        } finally {
            setBusyAction("");
        }
    }

    async function handlePrint() {
        if (!invoice) return;
        try {
            const resp = await fetchInvoicePdf(invoice.id);
            const blob = new Blob([resp.data], {
                type: resp.headers["content-type"] || "application/pdf",
            });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener");
        } catch (err) {
            console.error("Print failed", err);
            setError("Unable to open invoice print view.");
        }
    }

    async function handleCreditSummaryPdf() {
        if (!invoice) return;
        try {
            const resp = await fetchPatientSummaryPdf(invoice.patient_id);
            const blob = new Blob([resp.data], {
                type: resp.headers["content-type"] || "application/pdf",
            });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener");
        } catch (err) {
            console.error("Patient summary print failed", err);
            setError("Unable to open patient billing summary.");
        }
    }

    function handleOpenRefundModal() {
        setIsRefund(true);
        setShowPaymentForm(true);
    }

    function handleOpenPaymentModal() {
        setIsRefund(false);
        setShowPaymentForm(true);
    }

    function handleAddPackageCharge(pkgId) {
        if (!invoice || !pkgId) return;
        const pkg = masters.packages.find((p) => String(p.id) === String(pkgId));
        if (!pkg) return;

        // Quick helper: add package charges as a manual item
        const payload = {
            description: `Package: ${pkg.name}`,
            quantity: 1,
            unit_price: Number(pkg.charges || 0),
            tax_rate: 0,
            discount_percent: 0,
        };

        addManualItem(invoice.id, payload)
            .then(({ data }) => setInvoice(data))
            .catch((err) => {
                console.error("Add package charge failed", err);
                setError("Unable to add package charge.");
            });
    }

    const activePackages = masters.packages || [];

    const statusClass =
        invoice?.status === "finalized"
            ? "bg-green-100 text-green-800"
            : invoice?.status === "cancelled"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800";

    const payments = invoice?.payments || [];
    const items = invoice?.items || [];

    const positivePayments = useMemo(
        () => payments.filter((p) => Number(p.amount || 0) >= 0),
        [payments]
    );
    const refundPayments = useMemo(
        () => payments.filter((p) => Number(p.amount || 0) < 0),
        [payments]
    );

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 md:px-6 py-4">
                <div className="max-w-5xl mx-auto text-xs text-slate-500">
                    Loading invoice...
                </div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 md:px-6 py-4">
                <div className="max-w-5xl mx-auto">
                    <p className="text-xs text-red-600 mb-2">
                        {error || "Invoice not found."}
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate("/billing")}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                        &laquo; Back to Billing Console
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50 px-3 md:px-6 pb-20 md:pb-4 pt-4">
            <div className="max-w-5xl mx-auto space-y-4">
                {/* Top breadcrumb + actions */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate("/billing")}
                            className="text-xs text-slate-500 hover:text-slate-700"
                        >
                            &laquo; Billing Console
                        </button>
                        <span className="text-xs text-slate-400">/</span>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm md:text-base font-semibold text-slate-900">
                                Invoice #{invoice.invoice_number || invoice.id}
                            </h1>
                            <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusClass}`}
                            >
                                {invoice.status}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="text-xs rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
                        >
                            Print Invoice
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                        {error}
                    </div>
                )}

                {/* Patient credit summary */}
                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-sky-50 to-purple-50 p-3 md:p-4 shadow-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-800">
                            Patient Credit Overview
                        </div>
                        <div className="text-[11px] text-slate-500">
                            Patient ID: <span className="font-medium">#{invoice.patient_id}</span>
                        </div>
                        {patientSummary?.patient && (
                            <div className="text-[11px] text-slate-600">
                                {patientSummary.patient.uhid && (
                                    <>
                                        UHID:{" "}
                                        <span className="font-medium">
                                            {patientSummary.patient.uhid}
                                        </span>{" "}
                                        ·{" "}
                                    </>
                                )}
                                {(patientSummary.patient.first_name ||
                                    patientSummary.patient.last_name) && (
                                        <>
                                            {patientSummary.patient.first_name}{" "}
                                            {patientSummary.patient.last_name} ·{" "}
                                        </>
                                    )}
                                {patientSummary.patient.phone && (
                                    <>📞 {patientSummary.patient.phone}</>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                        <div className="rounded-full bg-white/80 border border-indigo-100 px-3 py-1 shadow-sm">
                            <span className="text-slate-500 mr-1">Total Outstanding:</span>
                            <span className="font-semibold text-red-700">
                                ₹{" "}
                                {formatMoney(
                                    patientSummary?.total_outstanding ??
                                    invoice.balance_due ??
                                    0
                                )}
                            </span>
                        </div>
                        <div className="rounded-full bg-white/80 border border-emerald-100 px-3 py-1 shadow-sm">
                            <span className="text-slate-500 mr-1">Advance Balance:</span>
                            <span className="font-semibold text-emerald-700">
                                ₹ {formatMoney(patientSummary?.advance_balance ?? 0)}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleCreditSummaryPdf}
                            disabled={loadingSummary}
                            className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                        >
                            {loadingSummary ? "Loading..." : "Credit Summary PDF"}
                        </button>
                    </div>
                </div>

                {/* Main layout */}
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Left column: header + totals + package */}
                    <div className="w-full md:w-2/5 space-y-4">
                        {/* Header card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-xs font-semibold text-slate-800">
                                    Invoice Header
                                </h2>
                                <span className="text-[11px] text-slate-400">
                                    Patient #{invoice.patient_id}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-600">
                                        Billing Type
                                    </label>
                                    <select
                                        name="billing_type"
                                        value={headerForm.billing_type}
                                        onChange={onHeaderChange}
                                        disabled={isFinalized}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                                    >
                                        <option value="op_billing">OP Billing</option>
                                        <option value="ip_billing">IP Billing</option>
                                        <option value="lab">Lab</option>
                                        <option value="pharmacy">Pharmacy</option>
                                        <option value="radiology">Radiology</option>
                                        <option value="general">General</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] text-slate-600">
                                            Consultant
                                        </label>
                                        <select
                                            name="consultant_id"
                                            value={headerForm.consultant_id}
                                            onChange={onHeaderChange}
                                            disabled={isFinalized}
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                                        >
                                            <option value="">None</option>
                                            {masters.doctors?.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name || `Doctor #${d.id}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] text-slate-600">
                                            Credit Provider
                                        </label>
                                        <select
                                            name="provider_id"
                                            value={headerForm.provider_id}
                                            onChange={onHeaderChange}
                                            disabled={isFinalized}
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                                        >
                                            <option value="">Self pay</option>
                                            {masters.credit_providers?.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.display_name || p.name || p.code || `Provider #${p.id}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] text-slate-600">
                                            Visit No (optional)
                                        </label>
                                        <input
                                            type="text"
                                            name="visit_no"
                                            value={headerForm.visit_no}
                                            onChange={onHeaderChange}
                                            disabled={isFinalized}
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] text-slate-600">
                                            Remarks
                                        </label>
                                        <input
                                            type="text"
                                            name="remarks"
                                            value={headerForm.remarks}
                                            onChange={onHeaderChange}
                                            disabled={isFinalized}
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                                        />
                                    </div>
                                </div>

                                {/* Discount fields */}
                                <div className="mt-2 border-t border-slate-100 pt-2 space-y-2">
                                    <div className="text-[11px] font-semibold text-slate-700">
                                        Header Discount
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] text-slate-600">
                                                Discount %
                                            </label>
                                            <input
                                                type="number"
                                                name="header_discount_percent"
                                                value={headerForm.header_discount_percent}
                                                onChange={onHeaderChange}
                                                disabled={isFinalized}
                                                step="0.1"
                                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] text-slate-600">
                                                Discount Amount
                                            </label>
                                            <input
                                                type="number"
                                                name="header_discount_amount"
                                                value={headerForm.header_discount_amount}
                                                onChange={onHeaderChange}
                                                disabled={isFinalized}
                                                step="0.01"
                                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] text-slate-600">
                                            Discount Remarks
                                        </label>
                                        <input
                                            type="text"
                                            name="discount_remarks"
                                            value={headerForm.discount_remarks}
                                            onChange={onHeaderChange}
                                            disabled={isFinalized}
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                                        />
                                    </div>
                                </div>

                                {!isFinalized && (
                                    <div className="pt-1 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleSaveHeader}
                                            disabled={savingHeader}
                                            className="px-3 py-1.5 rounded-full bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                                        >
                                            {savingHeader ? "Saving..." : "Save Header"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Totals card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm space-y-2 text-xs">
                            <h2 className="text-xs font-semibold text-slate-800">
                                Totals
                            </h2>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Gross Amount</span>
                                    <span className="font-medium text-slate-900">
                                        ₹ {formatMoney(invoice.gross_total)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Tax Total</span>
                                    <span className="font-medium text-slate-900">
                                        ₹ {formatMoney(invoice.tax_total)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Header Discount</span>
                                    <span className="font-medium text-orange-700">
                                        ₹ {formatMoney(invoice.header_discount_amount || 0)}{" "}
                                        {invoice.header_discount_percent
                                            ? `(${invoice.header_discount_percent}%)`
                                            : ""}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Net Amount</span>
                                    <span className="font-semibold text-slate-900">
                                        ₹ {formatMoney(invoice.net_total)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Amount Received</span>
                                    <span className="font-medium text-emerald-700">
                                        ₹ {formatMoney(invoice.amount_paid)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Advance Adjusted</span>
                                    <span className="font-medium text-slate-900">
                                        ₹ {formatMoney(invoice.advance_adjusted)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Previous Balance</span>
                                    <span className="font-medium text-slate-900">
                                        ₹ {formatMoney(invoice.previous_balance_snapshot)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Balance Due</span>
                                    <span className="font-semibold text-red-700">
                                        ₹ {formatMoney(invoice.balance_due)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Package billing helper */}
                        {activePackages.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm space-y-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="text-xs font-semibold text-slate-800">
                                        Package Billing (IPD)
                                    </h2>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-1">
                                    Quickly post a package charge to this invoice.
                                </p>
                                <select
                                    onChange={(e) => handleAddPackageCharge(e.target.value)}
                                    disabled={isFinalized}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                                    defaultValue=""
                                >
                                    <option value="">Select package to add...</option>
                                    {activePackages.map((pkg) => (
                                        <option key={pkg.id} value={pkg.id}>
                                            {pkg.name} — ₹ {formatMoney(pkg.charges)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Right column: items + payments */}
                    <div className="w-full md:w-3/5 space-y-4">
                        {/* Items card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-xs font-semibold text-slate-800">
                                    Items
                                </h2>
                                {!isFinalized && (
                                    <button
                                        type="button"
                                        onClick={() => setShowManualForm(true)}
                                        className="text-[11px] rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 shadow-sm"
                                    >
                                        + Add Manual Item
                                    </button>
                                )}
                            </div>

                            {items.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                    No items added yet.
                                </p>
                            ) : (
                                <div className="overflow-x-auto text-xs">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                    #
                                                </th>
                                                <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                    Description
                                                </th>
                                                <th className="px-2 py-1.5 text-right font-medium text-slate-500">
                                                    Qty
                                                </th>
                                                <th className="px-2 py-1.5 text-right font-medium text-slate-500">
                                                    Price
                                                </th>
                                                <th className="px-2 py-1.5 text-right font-medium text-slate-500">
                                                    GST%
                                                </th>
                                                <th className="px-2 py-1.5 text-right font-medium text-slate-500">
                                                    Disc
                                                </th>
                                                <th className="px-2 py-1.5 text-right font-medium text-slate-500">
                                                    Total
                                                </th>
                                                <th className="px-2 py-1.5"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {items.map((it, idx) => (
                                                <tr key={it.id} className="align-top">
                                                    <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-slate-800">
                                                        <div className="max-w-xs">
                                                            <div className="truncate">{it.description}</div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {it.service_type} #{it.service_ref_id}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right text-slate-700">
                                                        {it.quantity}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right text-slate-700">
                                                        {formatMoney(it.unit_price)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right text-slate-700">
                                                        {Number(it.tax_rate || 0)}%
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right text-slate-700">
                                                        {it.discount_percent
                                                            ? `${Number(it.discount_percent)}%`
                                                            : ""}
                                                        {it.discount_amount
                                                            ? ` / ₹ ${formatMoney(it.discount_amount)}`
                                                            : ""}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right text-slate-800">
                                                        {formatMoney(it.line_total)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                                        {!isFinalized && (
                                                            <div className="flex justify-end gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEditItem(it)}
                                                                    className="text-[10px] text-indigo-600 hover:text-indigo-800"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <span className="text-slate-300">|</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleVoidItem(it)}
                                                                    className="text-[10px] text-red-600 hover:text-red-800"
                                                                >
                                                                    Void
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Payments + refunds card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-xs font-semibold text-slate-800">
                                    Payments & Refunds
                                </h2>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleApplyAdvances}
                                        disabled={busyAction === "advance"}
                                        className="text-[11px] rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        {busyAction === "advance" ? "Applying..." : "Apply Advances"}
                                    </button>
                                    {!isFinalized && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleOpenRefundModal}
                                                className="text-[11px] rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700 hover:bg-red-100"
                                            >
                                                + Add Refund
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleOpenPaymentModal}
                                                className="text-[11px] rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
                                            >
                                                + Add Payment
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Positive payments */}
                            <div className="space-y-1">
                                <div className="text-[11px] font-semibold text-slate-700">
                                    Payments
                                </div>
                                {positivePayments.length === 0 ? (
                                    <p className="text-[11px] text-slate-500">
                                        No payments recorded.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto text-xs">
                                        <table className="min-w-full divide-y divide-slate-100">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                        Mode
                                                    </th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                        Reference
                                                    </th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                        Notes
                                                    </th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                        Paid At
                                                    </th>
                                                    <th className="px-2 py-1.5 text-right font-medium text-slate-500">
                                                        Amount
                                                    </th>
                                                    <th className="px-2 py-1.5"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {positivePayments.map((p) => (
                                                    <tr key={p.id}>
                                                        <td className="px-2 py-1.5 text-slate-800">
                                                            {p.mode}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-slate-600">
                                                            {p.reference_no || "—"}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-slate-600">
                                                            {p.notes || "—"}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-slate-500">
                                                            {p.paid_at
                                                                ? new Date(p.paid_at).toLocaleString()
                                                                : "—"}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right text-emerald-700 font-medium">
                                                            ₹ {formatMoney(p.amount)}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {!isFinalized && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeletePayment(p)}
                                                                    className="text-[10px] text-red-600 hover:text-red-800"
                                                                >
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Refunds */}
                            <div className="space-y-1 border-t border-slate-100 pt-2">
                                <div className="text-[11px] font-semibold text-slate-700">
                                    Refunds
                                </div>
                                {refundPayments.length === 0 ? (
                                    <p className="text-[11px] text-slate-500">
                                        No refunds recorded.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto text-xs">
                                        <table className="min-w-full divide-y divide-slate-100">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                        Mode
                                                    </th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                        Reference
                                                    </th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                        Notes
                                                    </th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500">
                                                        Time
                                                    </th>
                                                    <th className="px-2 py-1.5 text-right font-medium text-slate-500">
                                                        Amount
                                                    </th>
                                                    <th className="px-2 py-1.5"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {refundPayments.map((p) => (
                                                    <tr key={p.id}>
                                                        <td className="px-2 py-1.5 text-slate-800">
                                                            {p.mode}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-slate-600">
                                                            {p.reference_no || "—"}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-slate-600">
                                                            {p.notes || "—"}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-slate-500">
                                                            {p.paid_at
                                                                ? new Date(p.paid_at).toLocaleString()
                                                                : "—"}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right text-red-700 font-medium">
                                                            ₹ {formatMoney(p.amount)}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {!isFinalized && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeletePayment(p)}
                                                                    className="text-[10px] text-red-600 hover:text-red-800"
                                                                >
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom sticky totals & actions */}
                <div className="fixed inset-x-0 bottom-0 z-20 bg-white border-t border-slate-200 px-3 py-2 md:static md:border-none md:px-0 md:py-0 mt-3">
                    <div className="max-w-5xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700">
                                Net: ₹ {formatMoney(invoice.net_total)}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">
                                Paid: ₹ {formatMoney(invoice.amount_paid)}
                            </span>
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] text-red-700">
                                Balance: ₹ {formatMoney(invoice.balance_due)}
                            </span>
                        </div>
                        <div className="flex gap-2 justify-end">
                            {!isFinalized && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        disabled={busyAction === "cancel"}
                                        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        {busyAction === "cancel" ? "Cancelling..." : "Cancel Invoice"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleFinalize}
                                        disabled={busyAction === "finalize"}
                                        className="rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-4 py-1.5 text-xs font-medium text-white shadow-md hover:shadow-lg disabled:opacity-60"
                                    >
                                        {busyAction === "finalize" ? "Finalizing..." : "Finalize"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Manual item modal */}
            {showManualForm && !isFinalized && (
                <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40">
                    <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Add Manual Item
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowManualForm(false)}
                                className="text-xs text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <form className="space-y-3" onSubmit={handleAddManualItem}>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    name="description"
                                    value={manualForm.description}
                                    onChange={onManualChange}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Qty
                                    </label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        value={manualForm.quantity}
                                        min={1}
                                        onChange={onManualChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Unit Price
                                    </label>
                                    <input
                                        type="number"
                                        name="unit_price"
                                        value={manualForm.unit_price}
                                        step="0.01"
                                        onChange={onManualChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Tax %
                                    </label>
                                    <input
                                        type="number"
                                        name="tax_rate"
                                        value={manualForm.tax_rate}
                                        step="0.1"
                                        onChange={onManualChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Disc %
                                    </label>
                                    <input
                                        type="number"
                                        name="discount_percent"
                                        value={manualForm.discount_percent}
                                        step="0.1"
                                        onChange={onManualChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Disc Amount
                                    </label>
                                    <input
                                        type="number"
                                        name="discount_amount"
                                        value={manualForm.discount_amount}
                                        step="0.01"
                                        onChange={onManualChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowManualForm(false)}
                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                                >
                                    Add Item
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit item modal */}
            {editingItemId && !isFinalized && (
                <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40">
                    <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Edit Item
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditingItemId(null)}
                                className="text-xs text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <form className="space-y-3" onSubmit={handleUpdateItem}>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    name="description"
                                    value={itemForm.description}
                                    onChange={onItemChange}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Qty
                                    </label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        value={itemForm.quantity}
                                        min={1}
                                        onChange={onItemChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Unit Price
                                    </label>
                                    <input
                                        type="number"
                                        name="unit_price"
                                        value={itemForm.unit_price}
                                        step="0.01"
                                        onChange={onItemChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Tax %
                                    </label>
                                    <input
                                        type="number"
                                        name="tax_rate"
                                        value={itemForm.tax_rate}
                                        step="0.1"
                                        onChange={onItemChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Disc %
                                    </label>
                                    <input
                                        type="number"
                                        name="discount_percent"
                                        value={itemForm.discount_percent}
                                        step="0.1"
                                        onChange={onItemChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Disc Amount
                                    </label>
                                    <input
                                        type="number"
                                        name="discount_amount"
                                        value={itemForm.discount_amount}
                                        step="0.01"
                                        onChange={onItemChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingItemId(null)}
                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment / Refund modal */}
            {showPaymentForm && !isFinalized && (
                <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40">
                    <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900">
                                {isRefund ? "Add Refund" : "Add Payment"}
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPaymentForm(false);
                                    setIsRefund(false);
                                }}
                                className="text-xs text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <form className="space-y-3" onSubmit={handleAddPayment}>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Amount
                                    </label>
                                    <input
                                        type="number"
                                        name="amount"
                                        value={paymentForm.amount}
                                        onChange={onPaymentChange}
                                        step="0.01"
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                {!isRefund && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-700">
                                            Mode
                                        </label>
                                        <select
                                            name="mode"
                                            value={paymentForm.mode}
                                            onChange={onPaymentChange}
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="cash">Cash</option>
                                            <option value="card">Card</option>
                                            <option value="upi">UPI</option>
                                            <option value="credit">Credit</option>
                                            <option value="cheque">Cheque</option>
                                            <option value="neft">NEFT</option>
                                            <option value="rtgs">RTGS</option>
                                            <option value="wallet">Wallet</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                )}
                                {isRefund && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-700">
                                            Mode (optional)
                                        </label>
                                        <input
                                            type="text"
                                            name="mode"
                                            value={paymentForm.mode}
                                            onChange={onPaymentChange}
                                            placeholder="refund / bank / cash"
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Reference No (optional)
                                </label>
                                <input
                                    type="text"
                                    name="reference_no"
                                    value={paymentForm.reference_no}
                                    onChange={onPaymentChange}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Notes (optional)
                                </label>
                                <input
                                    type="text"
                                    name="notes"
                                    value={paymentForm.notes}
                                    onChange={onPaymentChange}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPaymentForm(false);
                                        setIsRefund(false);
                                    }}
                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${isRefund
                                            ? "bg-red-600 hover:bg-red-700"
                                            : "bg-indigo-600 hover:bg-indigo-700"
                                        }`}
                                >
                                    {isRefund ? "Save Refund" : "Save Payment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
