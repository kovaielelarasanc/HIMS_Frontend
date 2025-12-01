// FILE: src/billing/BillingConsole.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { listInvoices, getBillingMasters, createInvoice } from "../api/billing";
import PatientPicker from "../components/PatientPicker";

const BILLING_TABS = [
    { key: "all", label: "All" },
    { key: "op_billing", label: "OP Billing" },
    { key: "ip_billing", label: "IP Billing" },
    { key: "lab", label: "Lab" },
    { key: "pharmacy", label: "Pharmacy" },
    { key: "radiology", label: "Radiology" },
    { key: "general", label: "General" },
];

const STATUS_BADGE_CLASSES = {
    draft: "bg-yellow-100 text-yellow-800",
    finalized: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
};

const PAGE_SIZE = 10;

function formatMoney(x) {
    const n = Number(x || 0);
    return n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function BillingConsole() {
    const [activeTab, setActiveTab] = useState("all");
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [masters, setMasters] = useState({
        doctors: [],
        credit_providers: [],
        packages: [],
        payers: [],
        tpas: [],
        credit_plans: [],
    });
    const [showNewModal, setShowNewModal] = useState(false);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);

    const [newForm, setNewForm] = useState({
        patient_id: null,
        billing_type: "op_billing",
        context_type: "opd",
        context_id: "",
        remarks: "",
    });

    const navigate = useNavigate();

    useEffect(() => {
        loadMasters();
    }, []);

    useEffect(() => {
        loadInvoices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

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
            console.error("Failed to load billing masters", err);
        }
    }

    async function loadInvoices() {
        setLoading(true);
        setError("");
        try {
            const params = {};
            if (activeTab !== "all") {
                params.billing_type = activeTab;
            }
            const { data } = await listInvoices(params);
            setInvoices(data || []);
            setPage(1);
        } catch (err) {
            console.error("Failed to load invoices", err);
            setError("Unable to load invoices. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    function openInvoice(invId) {
        navigate(`/billing/invoices/${invId}`);
    }

    function onTabChange(key) {
        setActiveTab(key);
    }

    function onNewFormChange(e) {
        const { name, value } = e.target;
        setNewForm((prev) => ({ ...prev, [name]: value }));
    }

    function onPatientPick(value) {
        // Support both "id" and full object
        if (typeof value === "number") {
            setNewForm((prev) => ({ ...prev, patient_id: value }));
        } else if (value && typeof value === "object") {
            setNewForm((prev) => ({ ...prev, patient_id: value.id }));
        } else {
            setNewForm((prev) => ({ ...prev, patient_id: null }));
        }
    }

    async function handleCreateInvoice(e) {
        e.preventDefault();
        setError("");

        if (!newForm.patient_id) {
            setError("Please select a patient to create an invoice.");
            return;
        }

        try {
            const payload = {
                patient_id: Number(newForm.patient_id),
                billing_type: newForm.billing_type || null,
                context_type: newForm.context_type || null,
                context_id: newForm.context_id ? Number(newForm.context_id) : null,
                remarks: newForm.remarks || null,
            };

            const { data } = await createInvoice(payload);
            setShowNewModal(false);
            setNewForm({
                patient_id: null,
                billing_type: "op_billing",
                context_type: "opd",
                context_id: "",
                remarks: "",
            });
            navigate(`/billing/invoices/${data.id}`);
        } catch (err) {
            console.error("Create invoice failed", err);
            setError("Unable to create invoice. Please check details and try again.");
        }
    }

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(invoices.length / PAGE_SIZE)),
        [invoices.length]
    );

    const pageInvoices = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return invoices.slice(start, start + PAGE_SIZE);
    }, [invoices, page]);

    function goPrevPage() {
        setPage((p) => Math.max(1, p - 1));
    }

    function goNextPage() {
        setPage((p) => Math.min(totalPages, p + 1));
    }

    const startIndex = invoices.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endIndex =
        invoices.length === 0
            ? 0
            : Math.min(page * PAGE_SIZE, invoices.length);

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50 py-4 px-3 md:px-6">
            <div className="max-w-6xl mx-auto space-y-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
                            Billing Console
                        </h1>
                        <p className="text-xs md:text-sm text-slate-500">
                            One place to manage OP / IP / Lab / Pharmacy billing, refunds and
                            credit tracking.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowNewModal(true)}
                        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-4 py-2 text-xs md:text-sm font-medium text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        + New Invoice
                    </button>
                </div>

                {/* Tabs */}
                <div className="rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-purple-50 p-2 shadow-sm border border-slate-100">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {BILLING_TABS.map((tab) => {
                            const active = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => onTabChange(tab.key)}
                                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs md:text-[13px] font-medium transition-all ${active
                                            ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-md"
                                            : "bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 border border-slate-200"
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Card with list */}
                <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-slate-100">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-slate-800">
                                Invoices
                            </span>
                            <span className="text-[11px] text-slate-400">
                                {activeTab === "all"
                                    ? "All billing types"
                                    : `Filtered by ${BILLING_TABS.find(
                                        (t) => t.key === activeTab
                                    )?.label || ""}`}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={loadInvoices}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800"
                        >
                            Refresh
                        </button>
                    </div>

                    {error && (
                        <div className="px-3 md:px-4 py-2 bg-red-50 text-[11px] text-red-700">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="px-3 md:px-4 py-8 text-center text-xs text-slate-500">
                            Loading invoices...
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="px-3 md:px-4 py-8 text-center text-xs text-slate-500">
                            No invoices found for this filter.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto text-xs">
                                <table className="min-w-full divide-y divide-slate-100">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 md:px-4 py-2 text-left font-medium text-slate-500">
                                                Inv #
                                            </th>
                                            <th className="px-3 md:px-4 py-2 text-left font-medium text-slate-500">
                                                Billing Type
                                            </th>
                                            <th className="px-3 md:px-4 py-2 text-left font-medium text-slate-500">
                                                Patient
                                            </th>
                                            <th className="px-3 md:px-4 py-2 text-right font-medium text-slate-500">
                                                Net
                                            </th>
                                            <th className="px-3 md:px-4 py-2 text-right font-medium text-slate-500">
                                                Paid
                                            </th>
                                            <th className="px-3 md:px-4 py-2 text-right font-medium text-slate-500">
                                                Balance
                                            </th>
                                            <th className="px-3 md:px-4 py-2 text-left font-medium text-slate-500">
                                                Status
                                            </th>
                                            <th className="px-3 md:px-4 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pageInvoices.map((inv) => (
                                            <tr
                                                key={inv.id}
                                                className="hover:bg-slate-50 cursor-pointer"
                                                onClick={() => openInvoice(inv.id)}
                                            >
                                                <td className="px-3 md:px-4 py-2 text-slate-800 whitespace-nowrap">
                                                    {inv.invoice_number || inv.id}
                                                </td>
                                                <td className="px-3 md:px-4 py-2 text-slate-600 whitespace-nowrap">
                                                    {inv.billing_type || "general"}
                                                </td>
                                                <td className="px-3 md:px-4 py-2 text-slate-500 whitespace-nowrap">
                                                    #{inv.patient_id}
                                                </td>
                                                <td className="px-3 md:px-4 py-2 text-right text-slate-800 whitespace-nowrap">
                                                    ₹ {formatMoney(inv.net_total)}
                                                </td>
                                                <td className="px-3 md:px-4 py-2 text-right text-slate-600 whitespace-nowrap">
                                                    ₹ {formatMoney(inv.amount_paid)}
                                                </td>
                                                <td className="px-3 md:px-4 py-2 text-right text-slate-800 whitespace-nowrap">
                                                    ₹ {formatMoney(inv.balance_due)}
                                                </td>
                                                <td className="px-3 md:px-4 py-2 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASSES[inv.status] ||
                                                            "bg-slate-100 text-slate-700"
                                                            }`}
                                                    >
                                                        {inv.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 md:px-4 py-2 text-right whitespace-nowrap">
                                                    <span className="text-[11px] text-indigo-600 hover:text-indigo-800">
                                                        Open &raquo;
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 md:px-4 py-3 border-t border-slate-100 text-[11px]">
                                <div className="text-slate-500">
                                    Showing <span className="font-medium">{startIndex}</span>–
                                    <span className="font-medium">{endIndex}</span> of{" "}
                                    <span className="font-medium">{invoices.length}</span>{" "}
                                    invoices
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={goPrevPage}
                                        disabled={page === 1}
                                        className={`px-2.5 py-1 rounded-md border text-[11px] ${page === 1
                                                ? "border-slate-200 text-slate-300 cursor-not-allowed"
                                                : "border-slate-300 text-slate-700 hover:bg-slate-50"
                                            }`}
                                    >
                                        Prev
                                    </button>
                                    <span className="text-slate-500">
                                        Page{" "}
                                        <span className="font-semibold text-slate-800">
                                            {page}
                                        </span>{" "}
                                        / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={goNextPage}
                                        disabled={page === totalPages}
                                        className={`px-2.5 py-1 rounded-md border text-[11px] ${page === totalPages
                                                ? "border-slate-200 text-slate-300 cursor-not-allowed"
                                                : "border-slate-300 text-slate-700 hover:bg-slate-50"
                                            }`}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* New invoice modal with PatientPicker */}
            {showNewModal && (
                <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40">
                    <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-slate-900">
                                New Invoice
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowNewModal(false)}
                                className="text-xs text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form className="space-y-3" onSubmit={handleCreateInvoice}>
                            {/* PatientPicker instead of raw ID */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Patient
                                </label>
                                <PatientPicker
                                    value={newForm.patient_id}
                                    onChange={onPatientPick}
                                />
                                <p className="text-[10px] text-slate-400">
                                    Search by name / UHID / phone and pick the patient for billing.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Billing Type
                                    </label>
                                    <select
                                        name="billing_type"
                                        value={newForm.billing_type}
                                        onChange={onNewFormChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="op_billing">OP Billing</option>
                                        <option value="ip_billing">IP Billing</option>
                                        <option value="lab">Lab</option>
                                        <option value="pharmacy">Pharmacy</option>
                                        <option value="radiology">Radiology</option>
                                        <option value="general">General</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Context Type (optional)
                                    </label>
                                    <select
                                        name="context_type"
                                        value={newForm.context_type}
                                        onChange={onNewFormChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">None</option>
                                        <option value="opd">OPD</option>
                                        <option value="ipd">IPD</option>
                                        <option value="lab">Lab</option>
                                        <option value="radiology">Radiology</option>
                                        <option value="pharmacy">Pharmacy</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Context ID (optional)
                                    </label>
                                    <input
                                        type="number"
                                        name="context_id"
                                        value={newForm.context_id}
                                        onChange={onNewFormChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Visit / admission / order id"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Remarks (optional)
                                    </label>
                                    <input
                                        type="text"
                                        name="remarks"
                                        value={newForm.remarks}
                                        onChange={onNewFormChange}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Any note for this invoice"
                                    />
                                </div>
                            </div>

                            {error && (
                                <p className="text-[11px] text-red-600">{error}</p>
                            )}

                            <div className="flex gap-2 justify-end pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowNewModal(false)}
                                    className="px-3 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 rounded-md bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-700"
                                >
                                    Create &amp; Open
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
