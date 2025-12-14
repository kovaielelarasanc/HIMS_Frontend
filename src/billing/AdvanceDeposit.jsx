// FILE: src/billing/AdvanceDeposit.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    RefreshCcw,
    Plus,
    Wallet,
    ReceiptIndianRupee,
    BadgeCheck,
    BadgeInfo,
    ChevronDown,
    ChevronUp,
    Filter,
    Search,
    FileText,
    X,
} from "lucide-react";

import PatientPicker from "../components/PatientPicker";

import {
    createAdvance,
    listPatientAdvances,
    getPatientAdvanceSummary,
} from "../api/billing";

// shadcn/ui (adjust paths if your project differs)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

function formatMoney(x) {
    const n = Number(x || 0);
    return n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function toDateTime(s) {
    try {
        return s ? new Date(s).toLocaleString() : "—";
    } catch {
        return "—";
    }
}

function cls(...a) {
    return a.filter(Boolean).join(" ");
}

const fadeUp = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18 },
};

export default function AdvanceDeposit() {
    const navigate = useNavigate();
    const [sp] = useSearchParams();

    const initialPatientId = sp.get("patient_id") || "";

    const [patientId, setPatientId] = useState(initialPatientId);
    const [patient, setPatient] = useState(null);

    const [summary, setSummary] = useState(null);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const [showAdd, setShowAdd] = useState(false);
    const [saving, setSaving] = useState(false);

    // ✅ per-advance expand state (mobile-friendly)
    const [openUsed, setOpenUsed] = useState({}); // { [advanceId]: true }

    // ✅ UI filters
    const [q, setQ] = useState("");
    const [modeFilter, setModeFilter] = useState("all"); // all|cash|card|upi...
    const [usedFilter, setUsedFilter] = useState("all"); // all|used|unused

    const [form, setForm] = useState({
        amount: "",
        mode: "cash",
        reference_no: "",
        remarks: "",
        context_type: "",
        context_id: "",
    });

    const canLoad = useMemo(() => !!Number(patientId || 0), [patientId]);

    async function loadAll(pid) {
        const id = Number(pid || 0);
        if (!id) return;

        setLoading(true);
        try {
            const [s, r] = await Promise.all([
                getPatientAdvanceSummary(id),
                listPatientAdvances(id),
            ]);
            setSummary(s.data || null);
            setRows(r.data || []);
        } catch (e) {
            console.error(e);
            toast.error("Unable to load advance/deposit data");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (canLoad) loadAll(patientId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canLoad]);

    function onChange(e) {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
    }

    async function submitAdd(e) {
        e.preventDefault();

        const pid = Number(patientId || 0);
        const amt = Number(form.amount || 0);

        if (!pid) return toast.error("Patient is required");
        if (!amt || amt <= 0) return toast.error("Amount must be > 0");

        setSaving(true);
        try {
            await createAdvance({
                patient_id: pid,
                amount: amt,
                mode: form.mode || "cash",
                reference_no: form.reference_no || null,
                remarks: form.remarks || null,
                context_type: form.context_type || null,
                context_id: form.context_id ? Number(form.context_id) : null,
            });

            toast.success("Advance/Deposit added");
            setShowAdd(false);
            setForm({
                amount: "",
                mode: "cash",
                reference_no: "",
                remarks: "",
                context_type: "",
                context_id: "",
            });

            await loadAll(pid);
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.detail || "Unable to add advance/deposit");
        } finally {
            setSaving(false);
        }
    }

    const patientLabel = useMemo(() => {
        if (!patient) return null;
        const uhid =
            patient.uhid || `NH-${String(patient.id ?? "").toString().padStart(6, "0")}`;
        const name =
            patient.name ||
            [patient.first_name, patient.last_name].filter(Boolean).join(" ") ||
            "Unnamed";
        return { uhid, name, phone: patient.phone || null };
    }, [patient]);

    function toggleUsed(advanceId) {
        setOpenUsed((p) => ({ ...p, [advanceId]: !p[advanceId] }));
    }

    function goInvoice(invoiceId) {
        if (!invoiceId) return;
        navigate(`/billing/invoices/${invoiceId}`);
    }

    function usedSummary(a) {
        const list = a?.used_invoices || [];
        if (!Array.isArray(list) || list.length === 0) return { count: 0, total: 0 };
        const total = list.reduce((sum, u) => sum + Number(u.amount_applied || 0), 0);
        return { count: list.length, total };
    }

    const filteredRows = useMemo(() => {
        const term = (q || "").trim().toLowerCase();

        return (rows || []).filter((a) => {
            const used = usedSummary(a);
            const isUsed = used.count > 0;

            if (usedFilter === "used" && !isUsed) return false;
            if (usedFilter === "unused" && isUsed) return false;

            if (modeFilter !== "all" && String(a.mode || "").toLowerCase() !== modeFilter)
                return false;

            if (!term) return true;

            const ref = String(a.reference_no || "").toLowerCase();
            const ctx = `${a.context_type || ""} ${a.context_id || ""}`.toLowerCase();
            const amt = String(a.amount || "").toLowerCase();
            const rem = String(a.balance_remaining || "").toLowerCase();

            // also search used invoice numbers
            const usedList = Array.isArray(a.used_invoices) ? a.used_invoices : [];
            const usedInvoiceText = usedList
                .map((u) => `${u.invoice_number || ""} ${u.invoice_uid || ""} ${u.invoice_id || ""}`)
                .join(" ")
                .toLowerCase();

            return (
                ref.includes(term) ||
                ctx.includes(term) ||
                amt.includes(term) ||
                rem.includes(term) ||
                usedInvoiceText.includes(term)
            );
        });
    }, [rows, q, modeFilter, usedFilter]);

    const totals = useMemo(() => {
        return {
            total: summary?.total_advance || 0,
            used: summary?.used_advance || 0,
            available: summary?.available_advance || 0,
        };
    }, [summary]);

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50">
            <div className="mx-auto max-w-6xl px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-5">
                {/* ✅ Sticky header */}
                <div className="sticky top-0 z-20 -mx-3 md:-mx-6 px-3 md:px-6 py-3 backdrop-blur bg-white/70 border-b border-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-slate-700"
                                onClick={() => navigate("/billing")}
                            >
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Billing
                            </Button>
                            <div className="h-5 w-px bg-slate-200" />
                            <div>
                                <div className="text-sm md:text-base font-semibold text-slate-900">
                                    Advance / Deposit
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    Collect deposits and track which invoices consumed them
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9"
                                disabled={!canLoad || loading}
                                onClick={() => loadAll(patientId)}
                            >
                                <RefreshCcw className={cls("h-4 w-4 mr-2", loading && "animate-spin")} />
                                {loading ? "Refreshing" : "Refresh"}
                            </Button>

                            <Button
                                size="sm"
                                className="h-9"
                                onClick={() => {
                                    if (!Number(patientId || 0)) {
                                        toast.error("Select a patient first");
                                        return;
                                    }
                                    setShowAdd(true);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Deposit
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ✅ Patient + Summary */}
                <motion.div {...fadeUp}>
                    <Card className="rounded-3xl shadow-sm border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-slate-700" />
                                Patient & Balance
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
                                {/* Patient picker */}
                                <div className="space-y-2">
                                    <div className="text-[11px] font-medium text-slate-600">
                                        Select Patient
                                    </div>

                                    <PatientPicker
                                        value={patientId}
                                        onChange={(id, obj) => {
                                            setPatientId(String(id));
                                            setPatient(obj || null);
                                        }}
                                        onSelect={(id, obj) => {
                                            setPatientId(String(id));
                                            setPatient(obj || null);
                                        }}
                                    />

                                    {patientLabel ? (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                            <div className="text-[11px] text-slate-500">Selected</div>
                                            <div className="text-sm font-semibold text-slate-900">
                                                {patientLabel.uhid} — {patientLabel.name}
                                            </div>
                                            <div className="text-[11px] text-slate-600">
                                                {patientLabel.phone ? `📞 ${patientLabel.phone}` : "No phone"}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-slate-500">
                                            Search by UHID / Name / Phone
                                        </div>
                                    )}
                                </div>

                                {/* Summary cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[11px] font-medium text-slate-500">
                                                Total Deposited
                                            </div>
                                            <ReceiptIndianRupee className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <div className="mt-2 text-xl font-extrabold text-slate-900">
                                            ₹ {formatMoney(totals.total)}
                                        </div>
                                        <div className="mt-1 text-[11px] text-slate-500">
                                            All deposits received
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[11px] font-medium text-amber-700">
                                                Used
                                            </div>
                                            <BadgeInfo className="h-4 w-4 text-amber-700" />
                                        </div>
                                        <div className="mt-2 text-xl font-extrabold text-amber-900">
                                            ₹ {formatMoney(totals.used)}
                                        </div>
                                        <div className="mt-1 text-[11px] text-amber-800/80">
                                            Consumed by invoices
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[11px] font-medium text-emerald-700">
                                                Available
                                            </div>
                                            <BadgeCheck className="h-4 w-4 text-emerald-700" />
                                        </div>
                                        <div className="mt-2 text-xl font-extrabold text-emerald-900">
                                            ₹ {formatMoney(totals.available)}
                                        </div>
                                        <div className="mt-1 text-[11px] text-emerald-800/80">
                                            Ready to apply
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* ✅ Search + filters */}
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div className="flex-1 flex items-center gap-2">
                                    <div className="relative w-full md:max-w-md">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input
                                            value={q}
                                            onChange={(e) => setQ(e.target.value)}
                                            placeholder="Search by ref / context / amount / invoice number…"
                                            className="pl-9 rounded-2xl"
                                        />
                                    </div>

                                    {(q || modeFilter !== "all" || usedFilter !== "all") && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9"
                                            onClick={() => {
                                                setQ("");
                                                setModeFilter("all");
                                                setUsedFilter("all");
                                            }}
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Clear
                                        </Button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="inline-flex items-center gap-2 text-[11px] text-slate-500">
                                        <Filter className="h-4 w-4" />
                                        Filters
                                    </div>

                                    <select
                                        className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-xs"
                                        value={modeFilter}
                                        onChange={(e) => setModeFilter(e.target.value)}
                                    >
                                        <option value="all">All modes</option>
                                        <option value="cash">Cash</option>
                                        <option value="card">Card</option>
                                        <option value="upi">UPI</option>
                                        <option value="cheque">Cheque</option>
                                        <option value="neft/rtgs">NEFT/RTGS</option>
                                        <option value="wallet">Wallet</option>
                                        <option value="other">Other</option>
                                    </select>

                                    <select
                                        className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-xs"
                                        value={usedFilter}
                                        onChange={(e) => setUsedFilter(e.target.value)}
                                    >
                                        <option value="all">All</option>
                                        <option value="used">Used only</option>
                                        <option value="unused">Unused only</option>
                                    </select>

                                    <Badge variant="secondary" className="rounded-full">
                                        {filteredRows.length} shown
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* ✅ Deposits list */}
                <motion.div {...fadeUp}>
                    <Card className="rounded-3xl shadow-sm border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-700" />
                                Deposit Entries
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            {!canLoad ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                                    <div className="text-sm font-semibold text-slate-900">
                                        Select a patient
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                        Choose a patient to view deposit history and usage.
                                    </div>
                                </div>
                            ) : loading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-full rounded-2xl" />
                                    <Skeleton className="h-10 w-full rounded-2xl" />
                                    <Skeleton className="h-10 w-full rounded-2xl" />
                                </div>
                            ) : filteredRows.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                                    <div className="text-sm font-semibold text-slate-900">
                                        No deposits found
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                        Try clearing filters or add a new deposit.
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* ✅ Desktop table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-slate-50">
                                                <tr className="text-slate-500">
                                                    <th className="px-3 py-3 text-left font-semibold">Date</th>
                                                    <th className="px-3 py-3 text-left font-semibold">Mode</th>
                                                    <th className="px-3 py-3 text-left font-semibold">Ref</th>
                                                    <th className="px-3 py-3 text-left font-semibold">Context</th>
                                                    <th className="px-3 py-3 text-left font-semibold">Used Invoices</th>
                                                    <th className="px-3 py-3 text-right font-semibold">Amount</th>
                                                    <th className="px-3 py-3 text-right font-semibold">Remaining</th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100">
                                                {filteredRows.map((a) => {
                                                    const used = usedSummary(a);
                                                    const usedList = a?.used_invoices || [];

                                                    return (
                                                        <tr key={a.id} className="align-top hover:bg-slate-50/60">
                                                            <td className="px-3 py-3 text-slate-800">
                                                                <div className="font-semibold">
                                                                    {toDateTime(a.received_at)}
                                                                </div>
                                                                <div className="text-[11px] text-slate-500">
                                                                    #{a.id}
                                                                </div>
                                                            </td>

                                                            <td className="px-3 py-3">
                                                                <Badge className="rounded-full" variant="secondary">
                                                                    {String(a.mode || "-").toUpperCase()}
                                                                </Badge>
                                                            </td>

                                                            <td className="px-3 py-3 text-slate-700">
                                                                {a.reference_no || <span className="text-slate-400">—</span>}
                                                            </td>

                                                            <td className="px-3 py-3 text-slate-700">
                                                                {a.context_type ? (
                                                                    <div className="inline-flex items-center gap-2">
                                                                        <Badge variant="outline" className="rounded-full">
                                                                            {a.context_type}
                                                                        </Badge>
                                                                        {a.context_id ? (
                                                                            <span className="text-slate-500">#{a.context_id}</span>
                                                                        ) : null}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400">—</span>
                                                                )}
                                                            </td>

                                                            <td className="px-3 py-3">
                                                                {used.count === 0 ? (
                                                                    <span className="text-slate-400">Not used</span>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Badge className="rounded-full bg-amber-100 text-amber-900 hover:bg-amber-100">
                                                                                {used.count} invoices
                                                                            </Badge>
                                                                            <span className="text-[11px] text-slate-500">
                                                                                ₹ {formatMoney(used.total)}
                                                                            </span>
                                                                        </div>

                                                                        <div className="space-y-1">
                                                                            {usedList.slice(0, 3).map((u) => (
                                                                                <div key={u.id} className="text-[11px]">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => goInvoice(u.invoice_id)}
                                                                                        className="font-semibold text-indigo-600 hover:underline"
                                                                                        title="Open invoice"
                                                                                    >
                                                                                        {u.invoice_number ||
                                                                                            u.invoice_uid ||
                                                                                            `Invoice #${u.invoice_id}`}
                                                                                    </button>
                                                                                    <span className="text-slate-500">
                                                                                        {" "}
                                                                                        • ₹ {formatMoney(u.amount_applied)} •{" "}
                                                                                        {toDateTime(u.applied_at)}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                            {usedList.length > 3 && (
                                                                                <div className="text-[11px] text-slate-400">
                                                                                    +{usedList.length - 3} more…
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td className="px-3 py-3 text-right font-extrabold text-slate-900">
                                                                ₹ {formatMoney(a.amount)}
                                                            </td>

                                                            <td className="px-3 py-3 text-right font-extrabold text-emerald-700">
                                                                ₹ {formatMoney(a.balance_remaining)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* ✅ Mobile cards */}
                                    <div className="md:hidden space-y-3">
                                        {filteredRows.map((a) => {
                                            const used = usedSummary(a);
                                            const usedList = a?.used_invoices || [];
                                            const isOpen = !!openUsed[a.id];

                                            return (
                                                <div
                                                    key={a.id}
                                                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="text-xs text-slate-500">
                                                                {toDateTime(a.received_at)}
                                                            </div>
                                                            <div className="mt-1 text-base font-extrabold text-slate-900">
                                                                ₹ {formatMoney(a.amount)}
                                                            </div>

                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                <Badge className="rounded-full" variant="secondary">
                                                                    {String(a.mode || "-").toUpperCase()}
                                                                </Badge>
                                                                {a.context_type ? (
                                                                    <Badge className="rounded-full" variant="outline">
                                                                        {a.context_type}
                                                                        {a.context_id ? ` #${a.context_id}` : ""}
                                                                    </Badge>
                                                                ) : null}
                                                            </div>

                                                            <div className="mt-2 text-[11px] text-slate-500">
                                                                Ref: {a.reference_no || "—"}
                                                            </div>
                                                        </div>

                                                        <div className="text-right">
                                                            <div className="text-[11px] text-slate-500">Remaining</div>
                                                            <div className="text-sm font-extrabold text-emerald-700">
                                                                ₹ {formatMoney(a.balance_remaining)}
                                                            </div>

                                                            {used.count > 0 ? (
                                                                <div className="mt-2 space-y-1">
                                                                    <Badge className="rounded-full bg-amber-100 text-amber-900 hover:bg-amber-100">
                                                                        {used.count} used
                                                                    </Badge>
                                                                    <div className="text-[11px] text-slate-500">
                                                                        ₹ {formatMoney(used.total)}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="mt-2 text-[11px] text-slate-400">
                                                                    Not used
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {used.count > 0 && (
                                                        <div className="mt-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleUsed(a.id)}
                                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 flex items-center justify-between"
                                                            >
                                                                <span>Used Invoices</span>
                                                                {isOpen ? (
                                                                    <ChevronUp className="h-4 w-4 text-slate-600" />
                                                                ) : (
                                                                    <ChevronDown className="h-4 w-4 text-slate-600" />
                                                                )}
                                                            </button>

                                                            <AnimatePresence>
                                                                {isOpen && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: "auto", opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        transition={{ duration: 0.18 }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div className="mt-2 rounded-2xl border border-slate-200 overflow-hidden">
                                                                            {usedList.map((u) => (
                                                                                <button
                                                                                    key={u.id}
                                                                                    type="button"
                                                                                    onClick={() => goInvoice(u.invoice_id)}
                                                                                    className="w-full text-left px-3 py-2 border-b last:border-b-0 border-slate-100 hover:bg-indigo-50"
                                                                                >
                                                                                    <div className="text-xs font-extrabold text-slate-900">
                                                                                        {u.invoice_number ||
                                                                                            u.invoice_uid ||
                                                                                            `Invoice #${u.invoice_id}`}
                                                                                    </div>
                                                                                    <div className="text-[11px] text-slate-500">
                                                                                        ₹ {formatMoney(u.amount_applied)} •{" "}
                                                                                        {toDateTime(u.applied_at)}
                                                                                        {u.billing_type ? ` • ${u.billing_type}` : ""}
                                                                                        {u.status ? ` • ${u.status}` : ""}
                                                                                    </div>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* ✅ Add modal */}
                <AnimatePresence>
                    {showAdd && (
                        <motion.div
                            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="w-full sm:max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200"
                                initial={{ y: 18, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 18, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                            >
                                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-extrabold text-slate-900">
                                            Add Advance / Deposit
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            Record received amount for the selected patient
                                        </div>
                                    </div>

                                    <Button variant="ghost" size="icon" onClick={() => setShowAdd(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="p-4 space-y-3">
                                    {/* patient preview */}
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                        <div className="text-[11px] text-slate-500">Patient</div>
                                        <div className="text-sm font-extrabold text-slate-900">
                                            {patientLabel ? (
                                                <>
                                                    {patientLabel.uhid} — {patientLabel.name}
                                                    {patientLabel.phone ? (
                                                        <span className="text-slate-600">
                                                            {" "}
                                                            · 📞 {patientLabel.phone}
                                                        </span>
                                                    ) : null}
                                                </>
                                            ) : (
                                                <>Patient #{patientId}</>
                                            )}
                                        </div>
                                    </div>

                                    <form onSubmit={submitAdd} className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-slate-700">
                                                    Amount
                                                </label>
                                                <Input
                                                    type="number"
                                                    name="amount"
                                                    value={form.amount}
                                                    onChange={onChange}
                                                    step="0.01"
                                                    className="rounded-2xl"
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-slate-700">
                                                    Mode
                                                </label>
                                                <select
                                                    name="mode"
                                                    value={form.mode}
                                                    onChange={onChange}
                                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                                                >
                                                    <option value="cash">Cash</option>
                                                    <option value="card">Card</option>
                                                    <option value="upi">UPI</option>
                                                    <option value="cheque">Cheque</option>
                                                    <option value="neft/rtgs">NEFT/RTGS</option>
                                                    <option value="wallet">Wallet</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-slate-700">
                                                    Reference (optional)
                                                </label>
                                                <Input
                                                    name="reference_no"
                                                    value={form.reference_no}
                                                    onChange={onChange}
                                                    className="rounded-2xl"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-slate-700">
                                                    Remarks (optional)
                                                </label>
                                                <Input
                                                    name="remarks"
                                                    value={form.remarks}
                                                    onChange={onChange}
                                                    className="rounded-2xl"
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
                                            <div className="text-[11px] font-extrabold text-slate-800">
                                                Optional Context
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">
                                                        Context Type
                                                    </label>
                                                    <select
                                                        name="context_type"
                                                        value={form.context_type}
                                                        onChange={onChange}
                                                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                                                    >
                                                        <option value="">None</option>
                                                        <option value="opd">OPD</option>
                                                        <option value="ipd">IPD</option>
                                                        <option value="ot">OT</option>
                                                        <option value="pharmacy">Pharmacy</option>
                                                        <option value="lab">Lab</option>
                                                        <option value="radiology">Radiology</option>
                                                        <option value="general">General</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">
                                                        Context ID
                                                    </label>
                                                    <Input
                                                        name="context_id"
                                                        value={form.context_id}
                                                        onChange={onChange}
                                                        className="rounded-2xl"
                                                        placeholder="visit/admission/order id"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="rounded-2xl"
                                                onClick={() => setShowAdd(false)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button type="submit" className="rounded-2xl" disabled={saving}>
                                                {saving ? "Saving…" : "Save Deposit"}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
