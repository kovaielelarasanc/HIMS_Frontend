import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import {
    getInvoice,
    updateInvoice,
    addManualItem,
    addServiceItem, // reserved
    updateItem,
    voidItem,
    addPayment,
    deletePayment,
    finalizeInvoice,
    cancelInvoice,
    getBillingMasters,
    fetchInvoicePdf,
    getPatientBillingSummary,
    fetchPatientSummaryPdf,

    // backend-driven flows
    fetchUnbilledServices,
    bulkAddFromUnbilled,
    autoAddIpdBedCharges,
    autoAddOtCharges,

    // wallet (advance/deposit)
    getPatientAdvanceSummary,
    applyAdvanceWalletToInvoice,
} from "../api/billing";

import {
    ArrowLeft,
    BadgeCheck,
    Banknote,
    BedDouble,
    Building2,
    CalendarDays,
    CheckCircle2,
    Clock,
    CreditCard,
    FileDown,
    FileText,
    HandCoins,
    Hash,
    IndianRupee,
    Info,
    Layers,
    Loader2,
    MinusCircle,
    Package,
    Pencil,
    Plus,
    PlusCircle,
    Printer,
    Receipt,
    ShieldAlert,
    Trash2,
    Undo2,
    Wallet,
    X,
    XCircle,
    Copy,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

/* ---------------- helpers ---------------- */
function formatMoney(x) {
    const n = Number(x || 0);
    return n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
function cls(...a) {
    return a.filter(Boolean).join(" ");
}
function fmtDt(x) {
    try {
        if (!x) return "—";
        return new Date(x).toLocaleString();
    } catch {
        return "—";
    }
}
function statusPill(status) {
    const s = String(status || "").toLowerCase();
    if (s === "finalized")
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "cancelled")
        return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
}
function modeIcon(mode) {
    const m = String(mode || "").toLowerCase();
    if (m.includes("cash")) return Banknote;
    if (m.includes("upi")) return HandCoins;
    if (m.includes("card")) return CreditCard;
    if (m.includes("neft") || m.includes("rtgs") || m.includes("bank"))
        return Building2;
    if (m.includes("wallet")) return Wallet;
    if (m.includes("refund")) return Undo2;
    return Receipt;
}
function serviceIcon(serviceType) {
    const t = String(serviceType || "").toLowerCase();
    if (t.includes("ipd_bed")) return BedDouble;
    if (t.includes("ot")) return Layers;
    if (t.includes("pharmacy")) return Package;
    return FileText;
}

/* ---------------- tiny UI atoms ---------------- */
function Chip({ icon: Icon, label, value, tone = "slate" }) {
    const toneMap = {
        slate: "bg-slate-100 text-slate-700 border-slate-200",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
        indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
        rose: "bg-rose-50 text-rose-700 border-rose-200",
        amber: "bg-amber-50 text-amber-700 border-amber-200",
    };
    return (
        <div
            className={cls(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium",
                toneMap[tone] || toneMap.slate
            )}
        >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold">{value}</span>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, tone = "slate" }) {
    const tones = {
        slate: "border-slate-200 bg-white",
        indigo: "border-indigo-200 bg-indigo-50/40",
        emerald: "border-emerald-200 bg-emerald-50/40",
        rose: "border-rose-200 bg-rose-50/40",
        amber: "border-amber-200 bg-amber-50/40",
    };
    const vTone = {
        slate: "text-slate-900",
        indigo: "text-indigo-900",
        emerald: "text-emerald-900",
        rose: "text-rose-900",
        amber: "text-amber-900",
    };
    return (
        <div
            className={cls(
                "rounded-2xl border p-3 shadow-sm",
                tones[tone] || tones.slate
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-slate-600">{label}</div>
                {Icon ? (
                    <div className="h-8 w-8 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                        <Icon className="h-4 w-4 text-slate-700" />
                    </div>
                ) : null}
            </div>
            <div className={cls("mt-2 text-lg font-black", vTone[tone] || vTone.slate)}>
                {value}
            </div>
        </div>
    );
}

function ActionBtn({ icon: Icon, children, className = "", ...props }) {
    return (
        <button
            {...props}
            className={cls(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold shadow-sm transition",
                "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                className
            )}
        >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {children}
        </button>
    );
}

/* ---------------- Modal / Drawer (no shadcn) ---------------- */
function Modal({ open, title, icon: Icon, onClose, children, footer }) {
    useEffect(() => {
        if (!open) return;
        const onEsc = (e) => e.key === "Escape" && onClose?.();
        document.addEventListener("keydown", onEsc);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onEsc);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/45" onClick={onClose} />
            <div className="absolute inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6">
                <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200">
                    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            {Icon ? (
                                <div className="h-9 w-9 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                                    <Icon className="h-4 w-4 text-slate-800" />
                                </div>
                            ) : null}
                            <div>
                                <div className="text-sm font-black text-slate-900">{title}</div>
                                <div className="text-[11px] text-slate-500">
                                    Press Esc to close
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-10 w-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5 mx-auto" />
                        </button>
                    </div>

                    <div className="px-4 sm:px-6 py-4 max-h-[70vh] overflow-auto">
                        {children}
                    </div>

                    {footer ? (
                        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
                            {footer}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function Drawer({ open, title, subtitle, onClose, children, footer, width = "sm:w-[620px]" }) {
    useEffect(() => {
        if (!open) return;
        const onEsc = (e) => e.key === "Escape" && onClose?.();
        document.addEventListener("keydown", onEsc);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onEsc);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[55]">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className={cls("absolute right-0 top-0 h-full w-full", width, "bg-white shadow-2xl flex flex-col")}>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-black text-slate-900">{title}</div>
                        {subtitle ? (
                            <div className="text-[11px] text-slate-500">{subtitle}</div>
                        ) : null}
                    </div>
                    <button className="text-slate-500 hover:text-slate-900" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto">{children}</div>

                {footer ? (
                    <div className="p-4 border-t border-slate-100">{footer}</div>
                ) : null}
            </div>
        </div>
    );
}

function CopyBtn({ value, label = "Copy" }) {
    return (
        <button
            type="button"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(String(value || ""));
                    toast.success("Copied");
                } catch {
                    toast.error("Copy failed");
                }
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
            title="Copy"
        >
            <Copy className="h-4 w-4" />
            {label}
        </button>
    );
}

/* ---------------- section card ---------------- */
function SectionCard({ title, icon: Icon, right, children, tone = "white" }) {
    const bg = tone === "soft" ? "bg-white/80" : "bg-white";
    return (
        <div className={cls("rounded-3xl border border-slate-200", bg, "shadow-sm overflow-hidden")}>
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                    {Icon ? <Icon className="h-4 w-4 text-slate-700" /> : null}
                    <h2 className="text-[12px] md:text-[13px] font-black text-slate-900">
                        {title}
                    </h2>
                </div>
                {right}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

/* ---------------- page ---------------- */
export default function InvoiceDetail() {
    const params = useParams();
    const invoiceId = params.invoiceId || params.id;
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
    const [paymentKind, setPaymentKind] = useState("payment"); // payment | refund
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        mode: "cash",
        reference_no: "",
        notes: "",
    });

    const [walletSummary, setWalletSummary] = useState(null);
    const [walletLoading, setWalletLoading] = useState(false);
    const [showWalletApply, setShowWalletApply] = useState(false);
    const [walletApplyAmt, setWalletApplyAmt] = useState("");
    const [walletApplying, setWalletApplying] = useState(false);

    const [busyAction, setBusyAction] = useState("");
    const [error, setError] = useState("");

    const [patientSummary, setPatientSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    const [showUnbilled, setShowUnbilled] = useState(false);
    const [unbilledLoading, setUnbilledLoading] = useState(false);
    const [unbilled, setUnbilled] = useState([]);
    const [unbilledSelected, setUnbilledSelected] = useState({});

    const [ipdAuto, setIpdAuto] = useState({
        admission_id: "",
        mode: "daily",
        upto_ts: "",
    });
    const [otAuto, setOtAuto] = useState({
        case_id: "",
    });

    const [headerOpen, setHeaderOpen] = useState(true);

    const isFinalized =
        invoice?.status === "finalized" || invoice?.status === "cancelled";

    useEffect(() => {
        loadMasters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (invoiceId) loadInvoice();
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

    async function loadWalletSummary(patientId) {
        if (!patientId) return;
        setWalletLoading(true);
        try {
            const { data } = await getPatientAdvanceSummary(patientId);
            setWalletSummary(data || null);
        } catch (err) {
            console.error("Failed to load wallet summary", err);
            setWalletSummary(null);
        } finally {
            setWalletLoading(false);
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

            await Promise.all([
                loadPatientSummary(data.patient_id),
                loadWalletSummary(data.patient_id),
            ]);
        } catch (err) {
            console.error("Failed to load invoice", err);
            setError("Unable to load invoice. Please go back and try again.");
        } finally {
            setLoading(false);
        }
    }

    async function applyInvoiceResponseOrReload(resp) {
        const next = resp?.data;
        if (
            next &&
            typeof next === "object" &&
            (next.id || next.items || next.payments)
        ) {
            setInvoice(next);
            if (next.patient_id) {
                loadPatientSummary(next.patient_id);
                loadWalletSummary(next.patient_id);
            }
            return;
        }
        await loadInvoice();
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

            const resp = await updateInvoice(invoice.id, payload);
            await applyInvoiceResponseOrReload(resp);

            const fresh = resp?.data && resp.data.id ? resp.data : null;
            if (fresh) {
                setHeaderForm((prev) => ({
                    ...prev,
                    header_discount_percent: fresh.header_discount_percent ?? "",
                    header_discount_amount: fresh.header_discount_amount ?? "",
                }));
            }
            toast.success("Header saved");
        } catch (err) {
            console.error("Save header failed", err);
            setError("Unable to save header details.");
            toast.error("Header save failed");
        } finally {
            setSavingHeader(false);
        }
    }

    function onManualChange(e) {
        const { name, value } = e.target;
        setManualForm((prev) => ({
            ...prev,
            [name]:
                name === "quantity" ||
                    name === "tax_rate" ||
                    name === "discount_percent"
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
            const resp = await addManualItem(invoice.id, payload);
            await applyInvoiceResponseOrReload(resp);

            setShowManualForm(false);
            setManualForm({
                description: "",
                quantity: 1,
                unit_price: "",
                tax_rate: 0,
                discount_percent: 0,
                discount_amount: "",
            });
            toast.success("Item added");
        } catch (err) {
            console.error("Add manual item failed", err);
            setError("Unable to add manual item. Please check values.");
            toast.error("Add item failed");
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
                name === "quantity" ||
                    name === "tax_rate" ||
                    name === "discount_percent"
                    ? Number(value)
                    : value,
        }));
    }

    async function handleUpdateItem(e) {
        e.preventDefault();
        if (!invoice || !editingItemId) return;
        setError("");
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
            const resp = await updateItem(invoice.id, editingItemId, payload);
            await applyInvoiceResponseOrReload(resp);
            setEditingItemId(null);
            toast.success("Item updated");
        } catch (err) {
            console.error("Update item failed", err);
            setError("Unable to update item.");
            toast.error("Update failed");
        }
    }

    async function handleVoidItem(it) {
        if (!invoice) return;
        const reason = window.prompt("Void reason (required):", "Voided from UI");
        if (!reason || !reason.trim()) return;
        setError("");
        try {
            const resp = await voidItem(invoice.id, it.id, { reason: reason.trim() });
            await applyInvoiceResponseOrReload(resp);
            toast.success("Item voided");
        } catch (err) {
            console.error("Void item failed", err);
            setError("Unable to void item.");
            toast.error("Void failed");
        }
    }

    function onPaymentChange(e) {
        const { name, value } = e.target;
        setPaymentForm((prev) => ({ ...prev, [name]: value }));
    }

    function openPayment(kind) {
        setPaymentKind(kind);
        if (kind === "refund") {
            setPaymentForm((p) => ({ ...p, mode: "refund" }));
        } else {
            setPaymentForm((p) => ({ ...p, mode: "cash" }));
        }
        setShowPaymentForm(true);
    }

    async function handleAddPayment(e) {
        e.preventDefault();
        if (!invoice) return;
        setError("");

        try {
            let amount = Number(paymentForm.amount || 0);
            if (!amount || amount <= 0) {
                setError("Amount must be greater than 0.");
                return;
            }
            if (paymentKind === "refund") amount = -Math.abs(amount);

            const payload = {
                amount,
                mode: paymentKind === "refund" ? paymentForm.mode || "refund" : paymentForm.mode,
                reference_no: paymentForm.reference_no || null,
                notes: paymentForm.notes || null,
            };

            const resp = await addPayment(invoice.id, payload);
            await applyInvoiceResponseOrReload(resp);

            setShowPaymentForm(false);
            setPaymentKind("payment");
            setPaymentForm({ amount: "", mode: "cash", reference_no: "", notes: "" });
            toast.success(paymentKind === "refund" ? "Refund saved" : "Payment saved");
        } catch (err) {
            console.error("Add payment/refund failed", err);
            setError("Unable to save payment / refund.");
            toast.error("Save failed");
        }
    }

    async function handleDeletePayment(pay) {
        if (!invoice) return;
        const ok = window.confirm("Delete this entry?");
        if (!ok) return;
        setError("");
        try {
            await deletePayment(invoice.id, pay.id);
            await loadInvoice();
            toast.success("Deleted");
        } catch (err) {
            console.error("Delete failed", err);
            setError("Unable to delete.");
            toast.error("Delete failed");
        }
    }

    function openWalletApply() {
        if (!invoice) return;
        setWalletApplyAmt("");
        setShowWalletApply(true);
    }

    async function handleWalletApplySubmit(e) {
        e.preventDefault();
        if (!invoice) return;

        const available = Number(walletSummary?.available_advance ?? walletSummary?.available ?? 0);
        const amt = Number(walletApplyAmt || 0);

        if (!amt || amt <= 0) return setError("Enter a valid amount to apply.");
        if (amt > available) return setError("Apply amount cannot exceed available deposit.");
        if (amt > Number(invoice.balance_due || 0)) return setError("Apply amount cannot exceed invoice balance due.");

        const ok = window.confirm(`Use ₹ ${formatMoney(amt)} from patient Advance/Deposit for this invoice?`);
        if (!ok) return;

        setWalletApplying(true);
        setError("");
        try {
            const resp = await applyAdvanceWalletToInvoice(invoice.id, { amount: amt });
            setShowWalletApply(false);
            await applyInvoiceResponseOrReload(resp);
            toast.success("Deposit applied");
        } catch (err) {
            console.error("Wallet apply failed", err);
            setError("Unable to apply advance/deposit to this invoice.");
            toast.error("Apply failed");
        } finally {
            setWalletApplying(false);
        }
    }

    async function handleFinalize() {
        if (!invoice) return;
        const ok = window.confirm("Finalize this invoice? You cannot edit items later.");
        if (!ok) return;
        setBusyAction("finalize");
        setError("");
        try {
            const resp = await finalizeInvoice(invoice.id);
            await applyInvoiceResponseOrReload(resp);
            toast.success("Invoice finalized");
        } catch (err) {
            console.error("Finalize failed", err);
            setError("Unable to finalize invoice.");
            toast.error("Finalize failed");
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
            toast.success("Invoice cancelled");
        } catch (err) {
            console.error("Cancel failed", err);
            setError("Unable to cancel invoice.");
            toast.error("Cancel failed");
        } finally {
            setBusyAction("");
        }
    }

    async function handlePrint() {
        if (!invoice) return;
        try {
            const resp = await fetchInvoicePdf(invoice.id);
            const blob = new Blob([resp.data], {
                type: resp.headers?.["content-type"] || "application/pdf",
            });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener");
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (err) {
            console.error("Print failed", err);
            setError("Unable to open invoice print view.");
            toast.error("Print failed");
        }
    }

    async function handleCreditSummaryPdf() {
        if (!invoice) return;
        try {
            const resp = await fetchPatientSummaryPdf(invoice.patient_id);
            const blob = new Blob([resp.data], {
                type: resp.headers?.["content-type"] || "application/pdf",
            });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener");
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (err) {
            console.error("Patient summary print failed", err);
            setError("Unable to open patient billing summary.");
            toast.error("Open failed");
        }
    }

    function handleAddPackageCharge(pkgId) {
        if (!invoice || !pkgId) return;
        const pkg = masters.packages.find((p) => String(p.id) === String(pkgId));
        if (!pkg) return;

        const payload = {
            description: `Package: ${pkg.name}`,
            quantity: 1,
            unit_price: Number(pkg.charges || 0),
            tax_rate: 0,
            discount_percent: 0,
        };

        addManualItem(invoice.id, payload)
            .then((resp) => applyInvoiceResponseOrReload(resp))
            .then(() => toast.success("Package charge added"))
            .catch((err) => {
                console.error("Add package charge failed", err);
                setError("Unable to add package charge.");
                toast.error("Add failed");
            });
    }

    async function openUnbilled() {
        if (!invoice) return;
        setShowUnbilled(true);
        setUnbilledSelected({});
        setUnbilledLoading(true);
        setError("");
        try {
            const { data } = await fetchUnbilledServices(invoice.id);
            setUnbilled(data || []);
        } catch (e) {
            console.error(e);
            setError("Unable to load unbilled services.");
            toast.error("Load failed");
        } finally {
            setUnbilledLoading(false);
        }
    }

    function toggleUnbilled(uid) {
        setUnbilledSelected((p) => ({ ...p, [uid]: !p[uid] }));
    }

    async function addSelectedUnbilled() {
        if (!invoice) return;
        const uids = Object.keys(unbilledSelected).filter((k) => unbilledSelected[k]);
        if (uids.length === 0) return;

        setBusyAction("unbilled");
        setError("");
        try {
            await bulkAddFromUnbilled(invoice.id, { uids });
            setShowUnbilled(false);
            await loadInvoice();
            toast.success("Added unbilled services");
        } catch (e) {
            console.error(e);
            setError("Unable to add unbilled services.");
            toast.error("Add failed");
        } finally {
            setBusyAction("");
        }
    }

    async function handleIpdAutoPost() {
        if (!invoice) return;
        if (!ipdAuto.admission_id) {
            setError("Admission ID is required for IPD auto bed charges.");
            return;
        }
        setBusyAction("ipd_auto");
        setError("");
        try {
            await autoAddIpdBedCharges(invoice.id, {
                admission_id: Number(ipdAuto.admission_id),
                mode: ipdAuto.mode,
                upto_ts: ipdAuto.upto_ts ? ipdAuto.upto_ts : null,
                skip_if_already_billed: true,
            });
            await loadInvoice();
            toast.success("IPD charges posted");
        } catch (e) {
            console.error(e);
            setError("Unable to auto-post IPD bed charges.");
            toast.error("Post failed");
        } finally {
            setBusyAction("");
        }
    }

    async function handleOtAutoPost() {
        if (!invoice) return;
        if (!otAuto.case_id) {
            setError("Case ID is required for OT auto charges.");
            return;
        }
        setBusyAction("ot_auto");
        setError("");
        try {
            await autoAddOtCharges(invoice.id, { case_id: Number(otAuto.case_id) });
            await loadInvoice();
            toast.success("OT charges posted");
        } catch (e) {
            console.error(e);
            setError("Unable to auto-post OT charges.");
            toast.error("Post failed");
        } finally {
            setBusyAction("");
        }
    }

    const items = invoice?.items || [];
    const payments = invoice?.payments || [];

    const positivePayments = useMemo(
        () => payments.filter((p) => Number(p.amount || 0) >= 0),
        [payments]
    );
    const refundPayments = useMemo(
        () => payments.filter((p) => Number(p.amount || 0) < 0),
        [payments]
    );

    const refundsAbsTotal = useMemo(
        () => refundPayments.reduce((s, p) => s + Math.abs(Number(p.amount || 0)), 0),
        [refundPayments]
    );
    const paidTotal = useMemo(
        () => positivePayments.reduce((s, p) => s + Number(p.amount || 0), 0),
        [positivePayments]
    );

    const walletAvailable = Number(walletSummary?.available_advance ?? walletSummary?.available ?? 0);
    const depositUsed = Number(invoice?.advance_adjusted || 0);

    const advanceAdjustments = Array.isArray(invoice?.advance_adjustments)
        ? invoice.advance_adjustments
        : null;

    const activePackages = masters.packages || [];

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 md:px-6 py-8">
                <div className="max-w-6xl mx-auto flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading invoice…
                </div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 md:px-6 py-8">
                <div className="max-w-6xl mx-auto">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 mt-0.5" />
                        <div>{error || "Invoice not found."}</div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate("/billing")}
                        className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Billing Console
                    </button>
                </div>
            </div>
        );
    }

    const invTitle = `Invoice #${invoice.invoice_number || invoice.id}`;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50 ">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="w-full px-0 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => navigate("/billing")}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Billing</span>
                        </button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <h1 className="text-sm md:text-base font-black text-slate-900 truncate">
                                    {invTitle}
                                </h1>
                                <span
                                    className={cls(
                                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black",
                                        statusPill(invoice.status)
                                    )}
                                >
                                    {invoice.status === "finalized" ? (
                                        <BadgeCheck className="h-4 w-4" />
                                    ) : invoice.status === "cancelled" ? (
                                        <XCircle className="h-4 w-4" />
                                    ) : (
                                        <Clock className="h-4 w-4" />
                                    )}
                                    {invoice.status}
                                </span>
                            </div>

                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    {fmtDt(invoice.created_at)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Hash className="h-3.5 w-3.5" />
                                    Patient #{invoice.patient_id}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <ActionBtn icon={Layers} onClick={openUnbilled}>
                            Unbilled
                        </ActionBtn>
                        <ActionBtn icon={Printer} onClick={handlePrint}>
                            Print
                        </ActionBtn>
                        <CopyBtn value={invoice.invoice_number || invoice.id} label="Copy ID" />
                    </div>
                </div>
            </div>

            <div className="w-full px-0 py-4 space-y-4">
                {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 mt-0.5" />
                        <div>{error}</div>
                    </div>
                ) : null}

                {/* Hero Summary */}
                <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-sky-50 to-purple-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                            <div className="text-[12px] font-black text-slate-900 flex items-center gap-2">
                                <Info className="h-4 w-4 text-indigo-700" />
                                Patient Credit Overview
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Chip icon={Hash} label="Patient ID" value={`#${invoice.patient_id}`} tone="slate" />
                                {patientSummary?.patient?.uhid ? (
                                    <Chip icon={FileText} label="UHID" value={patientSummary.patient.uhid} tone="indigo" />
                                ) : null}
                                {patientSummary?.patient?.phone ? (
                                    <Chip icon={HandCoins} label="Phone" value={patientSummary.patient.phone} tone="slate" />
                                ) : null}
                            </div>

                            {patientSummary?.patient?.name ? (
                                <div className="text-[12px] text-slate-800">
                                    <span className="font-black">{patientSummary.patient.name}</span>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
                            <Chip
                                icon={MinusCircle}
                                label="Total Outstanding"
                                value={`₹ ${formatMoney(
                                    patientSummary?.total_outstanding ??
                                    patientSummary?.totals?.balance_due ??
                                    invoice.balance_due ??
                                    0
                                )}`}
                                tone="rose"
                            />

                            <Chip
                                icon={Wallet}
                                label="Deposit Available"
                                value={`₹ ${walletLoading ? "…" : formatMoney(walletAvailable)}`}
                                tone="emerald"
                            />

                            <ActionBtn
                                icon={PlusCircle}
                                onClick={() => navigate(`/billing/advance?patient_id=${invoice.patient_id}`)}
                                title="Open patient deposit page"
                            >
                                Add Deposit
                            </ActionBtn>

                            <button
                                type="button"
                                onClick={openWalletApply}
                                disabled={walletAvailable <= 0 || isFinalized}
                                className={cls(
                                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black shadow-sm transition",
                                    walletAvailable <= 0 || isFinalized
                                        ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                                )}
                                title="Use patient deposit (advance) for this invoice"
                            >
                                <Wallet className="h-4 w-4" />
                                Use Deposit
                            </button>

                            <button
                                type="button"
                                onClick={handleCreditSummaryPdf}
                                disabled={loadingSummary}
                                className={cls(
                                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black shadow-sm transition",
                                    loadingSummary ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
                                )}
                            >
                                <FileDown className="h-4 w-4" />
                                {loadingSummary ? "Loading…" : "Credit Summary PDF"}
                            </button>
                        </div>
                    </div>

                    {/* Totals grid */}
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard icon={Receipt} label="Gross" value={`₹ ${formatMoney(invoice.gross_total)}`} tone="slate" />
                        <StatCard icon={FileText} label="Tax" value={`₹ ${formatMoney(invoice.tax_total)}`} tone="slate" />
                        <StatCard icon={CheckCircle2} label="Net" value={`₹ ${formatMoney(invoice.net_total)}`} tone="indigo" />
                        <StatCard icon={MinusCircle} label="Balance Due" value={`₹ ${formatMoney(invoice.balance_due)}`} tone="rose" />
                    </div>
                </div>

                {/* Main grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left */}
                    <div className="lg:col-span-5 space-y-4">
                        {/* Header */}
                        <SectionCard
                            title="Invoice Header"
                            icon={Receipt}
                            right={
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setHeaderOpen((v) => !v)}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                                        title="Collapse/Expand"
                                    >
                                        {headerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        {headerOpen ? "Collapse" : "Expand"}
                                    </button>

                                    {!isFinalized ? (
                                        <button
                                            type="button"
                                            onClick={handleSaveHeader}
                                            disabled={savingHeader}
                                            className={cls(
                                                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black shadow-sm transition",
                                                savingHeader
                                                    ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                                                    : "bg-slate-900 text-white hover:bg-slate-800"
                                            )}
                                        >
                                            {savingHeader ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4" />
                                            )}
                                            {savingHeader ? "Saving…" : "Save"}
                                        </button>
                                    ) : (
                                        <div className="text-[11px] text-slate-500 font-bold">Locked</div>
                                    )}
                                </div>
                            }
                        >
                            {headerOpen ? (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-black text-slate-700">
                                            Billing Type
                                        </label>
                                        <select
                                            name="billing_type"
                                            value={headerForm.billing_type}
                                            onChange={onHeaderChange}
                                            disabled={isFinalized}
                                            className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                                        >
                                            <option value="op_billing">OP Billing</option>
                                            <option value="ip_billing">IP Billing</option>
                                            <option value="ot">OT</option>
                                            <option value="lab">Lab</option>
                                            <option value="pharmacy">Pharmacy</option>
                                            <option value="radiology">Radiology</option>
                                            <option value="general">General</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-black text-slate-700">
                                                Consultant
                                            </label>
                                            <select
                                                name="consultant_id"
                                                value={headerForm.consultant_id}
                                                onChange={onHeaderChange}
                                                disabled={isFinalized}
                                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
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
                                            <label className="text-[11px] font-black text-slate-700">
                                                Credit Provider
                                            </label>
                                            <select
                                                name="provider_id"
                                                value={headerForm.provider_id}
                                                onChange={onHeaderChange}
                                                disabled={isFinalized}
                                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                                            >
                                                <option value="">Self pay</option>
                                                {masters.credit_providers?.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.display_name ||
                                                            p.name ||
                                                            p.code ||
                                                            `Provider #${p.id}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-black text-slate-700">
                                                Visit No
                                            </label>
                                            <input
                                                type="text"
                                                name="visit_no"
                                                value={headerForm.visit_no}
                                                onChange={onHeaderChange}
                                                disabled={isFinalized}
                                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-black text-slate-700">
                                                Remarks
                                            </label>
                                            <input
                                                type="text"
                                                name="remarks"
                                                value={headerForm.remarks}
                                                onChange={onHeaderChange}
                                                disabled={isFinalized}
                                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                                            />
                                        </div>
                                    </div>

                                    {/* Discount */}
                                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex items-center gap-2 text-[12px] font-black text-slate-800">
                                            <IndianRupee className="h-4 w-4" />
                                            Header Discount
                                        </div>

                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black text-slate-700">
                                                    Discount %
                                                </label>
                                                <input
                                                    type="number"
                                                    name="header_discount_percent"
                                                    value={headerForm.header_discount_percent}
                                                    onChange={onHeaderChange}
                                                    disabled={isFinalized}
                                                    step="0.1"
                                                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black text-slate-700">
                                                    Discount Amount
                                                </label>
                                                <input
                                                    type="number"
                                                    name="header_discount_amount"
                                                    value={headerForm.header_discount_amount}
                                                    onChange={onHeaderChange}
                                                    disabled={isFinalized}
                                                    step="0.01"
                                                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-2 space-y-1">
                                            <label className="text-[11px] font-black text-slate-700">
                                                Discount Remarks
                                            </label>
                                            <input
                                                type="text"
                                                name="discount_remarks"
                                                value={headerForm.discount_remarks}
                                                onChange={onHeaderChange}
                                                disabled={isFinalized}
                                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                                            />
                                        </div>
                                    </div>

                                    {/* Package helper */}
                                    {activePackages.length > 0 ? (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-[12px] font-black text-slate-900 flex items-center gap-2">
                                                    <Package className="h-4 w-4" />
                                                    Package Billing (IPD)
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-bold">
                                                    Quick add
                                                </div>
                                            </div>
                                            <p className="mt-2 text-[11px] text-slate-500">
                                                Select a package to post a single consolidated charge into this invoice.
                                            </p>
                                            <select
                                                onChange={(e) => handleAddPackageCharge(e.target.value)}
                                                disabled={isFinalized}
                                                className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                                                defaultValue=""
                                            >
                                                <option value="">Select package…</option>
                                                {activePackages.map((pkg) => (
                                                    <option key={pkg.id} value={pkg.id}>
                                                        {pkg.name} — ₹ {formatMoney(pkg.charges)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 flex items-start gap-2">
                                    <Info className="h-4 w-4 mt-0.5" />
                                    Header is collapsed. Expand to edit billing type, consultant, provider, and discount.
                                </div>
                            )}
                        </SectionCard>

                        {/* Deposit used + adjustments */}
                        <SectionCard title="Deposit Adjustments" icon={Wallet}>
                            <div className="grid grid-cols-2 gap-3">
                                <StatCard
                                    icon={Wallet}
                                    label="Deposit Available"
                                    value={`₹ ${walletLoading ? "…" : formatMoney(walletAvailable)}`}
                                    tone="emerald"
                                />
                                <StatCard
                                    icon={Wallet}
                                    label="Deposit Used"
                                    value={`₹ ${formatMoney(depositUsed)}`}
                                    tone="indigo"
                                />
                            </div>

                            <div className="mt-3 rounded-3xl border border-indigo-200 bg-indigo-50 p-3">
                                <div className="text-[11px] text-indigo-900 font-black flex items-center gap-2">
                                    <Info className="h-4 w-4" />
                                    Adjustment rows (optional)
                                </div>

                                <div className="mt-2">
                                    {advanceAdjustments ? (
                                        advanceAdjustments.length === 0 ? (
                                            <div className="text-[11px] text-indigo-800">
                                                No adjustment rows.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-indigo-200 text-xs">
                                                    <thead className="bg-white/60">
                                                        <tr>
                                                            <th className="px-2 py-2 text-left font-black text-indigo-900">Advance ID</th>
                                                            <th className="px-2 py-2 text-left font-black text-indigo-900">Applied At</th>
                                                            <th className="px-2 py-2 text-right font-black text-indigo-900">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-indigo-200">
                                                        {advanceAdjustments.map((a) => (
                                                            <tr key={a.id || `${a.advance_id}-${a.applied_at}`}>
                                                                <td className="px-2 py-2 font-bold text-indigo-900">
                                                                    #{a.advance_id}
                                                                </td>
                                                                <td className="px-2 py-2 text-indigo-800">
                                                                    {fmtDt(a.applied_at)}
                                                                </td>
                                                                <td className="px-2 py-2 text-right font-black text-indigo-900">
                                                                    ₹ {formatMoney(a.amount_applied)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )
                                    ) : (
                                        <div className="rounded-2xl border border-indigo-200 bg-white/60 p-3 text-[11px] text-indigo-800">
                                            <span className="font-black">Total adjusted:</span>{" "}
                                            ₹ {formatMoney(depositUsed)}{" "}
                                            <span className="text-indigo-700/70">
                                                (enable `invoice.advance_adjustments` for per-row view)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    {/* Right */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Items */}
                        <SectionCard
                            title="Items"
                            icon={FileText}
                            right={
                                !isFinalized ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowManualForm(true)}
                                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[11px] font-black text-white hover:bg-slate-800"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Manual
                                    </button>
                                ) : (
                                    <div className="text-[11px] text-slate-500 font-bold">Locked</div>
                                )
                            }
                        >
                            {items.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-start gap-2">
                                    <Info className="h-4 w-4 mt-0.5" />
                                    No items added yet.
                                </div>
                            ) : (
                                <>
                                    {/* Mobile cards */}
                                    <div className="md:hidden space-y-3">
                                        {items.map((it) => {
                                            const SvcIcon = serviceIcon(it.service_type);
                                            return (
                                                <div
                                                    key={it.id}
                                                    className={cls(
                                                        "rounded-3xl border border-slate-200 bg-white p-3 shadow-sm",
                                                        it.is_voided && "opacity-70"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-start gap-2 min-w-0">
                                                            <div className="mt-0.5 rounded-2xl border border-slate-200 bg-white p-2">
                                                                <SvcIcon className="h-4 w-4 text-slate-700" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-black text-slate-900 truncate">
                                                                    {it.description}
                                                                </div>
                                                                <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-2">
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Hash className="h-3.5 w-3.5" />
                                                                        {it.service_type} / {it.service_ref_id}
                                                                    </span>
                                                                    {it.is_voided ? (
                                                                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700 font-black">
                                                                            <XCircle className="h-3.5 w-3.5" />
                                                                            VOID
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[11px] text-slate-500">Line Total</div>
                                                            <div className="text-sm font-black text-slate-900">
                                                                ₹ {formatMoney(it.line_total)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                                            <div className="text-slate-500">Qty</div>
                                                            <div className="font-black text-slate-900">{it.quantity}</div>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                                            <div className="text-slate-500">Price</div>
                                                            <div className="font-black text-slate-900">{formatMoney(it.unit_price)}</div>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                                            <div className="text-slate-500">GST</div>
                                                            <div className="font-black text-slate-900">{Number(it.tax_rate || 0)}%</div>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                                            <div className="text-slate-500">Disc</div>
                                                            <div className="font-black text-slate-900">
                                                                {it.discount_percent ? `${Number(it.discount_percent)}%` : "—"}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {!isFinalized ? (
                                                        <div className="mt-3 flex gap-2 justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditItem(it)}
                                                                className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleVoidItem(it)}
                                                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700 hover:bg-rose-100"
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                                Void
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Desktop table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-100 text-xs">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-2 py-2 text-left font-black text-slate-500">#</th>
                                                    <th className="px-2 py-2 text-left font-black text-slate-500">Description</th>
                                                    <th className="px-2 py-2 text-right font-black text-slate-500">Qty</th>
                                                    <th className="px-2 py-2 text-right font-black text-slate-500">Price</th>
                                                    <th className="px-2 py-2 text-right font-black text-slate-500">GST%</th>
                                                    <th className="px-2 py-2 text-right font-black text-slate-500">Disc</th>
                                                    <th className="px-2 py-2 text-right font-black text-slate-500">Total</th>
                                                    <th className="px-2 py-2"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {items.map((it, idx) => {
                                                    const SvcIcon = serviceIcon(it.service_type);
                                                    return (
                                                        <tr key={it.id} className="align-top">
                                                            <td className="px-2 py-2 whitespace-nowrap text-slate-500">{idx + 1}</td>
                                                            <td className="px-2 py-2 text-slate-900">
                                                                <div className="flex items-start gap-2">
                                                                    <div className="mt-0.5 rounded-xl border border-slate-200 bg-white p-1.5">
                                                                        <SvcIcon className="h-4 w-4 text-slate-700" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="font-black truncate max-w-[420px]">{it.description}</div>
                                                                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                                            <span className="inline-flex items-center gap-1">
                                                                                <Hash className="h-3 w-3" />
                                                                                {it.service_type} / {it.service_ref_id}
                                                                            </span>
                                                                            {it.is_voided ? (
                                                                                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700 font-black">
                                                                                    <XCircle className="h-3 w-3" />
                                                                                    VOID
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2 text-right text-slate-700">{it.quantity}</td>
                                                            <td className="px-2 py-2 text-right text-slate-700">{formatMoney(it.unit_price)}</td>
                                                            <td className="px-2 py-2 text-right text-slate-700">{Number(it.tax_rate || 0)}%</td>
                                                            <td className="px-2 py-2 text-right text-slate-700">
                                                                {it.discount_percent ? `${Number(it.discount_percent)}%` : "—"}
                                                                {it.discount_amount ? ` / ₹ ${formatMoney(it.discount_amount)}` : ""}
                                                            </td>
                                                            <td className="px-2 py-2 text-right text-slate-900 font-black">
                                                                ₹ {formatMoney(it.line_total)}
                                                            </td>
                                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                {!isFinalized ? (
                                                                    <div className="flex justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => startEditItem(it)}
                                                                            className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"
                                                                        >
                                                                            <Pencil className="h-3.5 w-3.5" />
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleVoidItem(it)}
                                                                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700 hover:bg-rose-100"
                                                                        >
                                                                            <XCircle className="h-3.5 w-3.5" />
                                                                            Void
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </SectionCard>

                        {/* Payments */}
                        <SectionCard
                            title="Payments & Refunds"
                            icon={CreditCard}
                            right={
                                !isFinalized ? (
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        <ActionBtn
                                            icon={Undo2}
                                            onClick={() => openPayment("refund")}
                                            className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                        >
                                            Add Refund
                                        </ActionBtn>

                                        <button
                                            type="button"
                                            onClick={() => openPayment("payment")}
                                            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-[11px] font-black text-white hover:bg-indigo-700"
                                        >
                                            <PlusCircle className="h-4 w-4" />
                                            Add Payment
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-500 font-bold">Locked</div>
                                )
                            }
                        >
                            <div className="flex flex-wrap gap-2 mb-3">
                                <Chip icon={Banknote} label="Payments" value={`₹ ${formatMoney(paidTotal)}`} tone="emerald" />
                                <Chip icon={Undo2} label="Refunds" value={`₹ ${formatMoney(refundsAbsTotal)}`} tone="rose" />
                                <Chip icon={Wallet} label="Deposit Used" value={`₹ ${formatMoney(depositUsed)}`} tone="indigo" />
                            </div>

                            {/* Mobile cards */}
                            <div className="md:hidden space-y-3">
                                {(payments || []).length === 0 ? (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-start gap-2">
                                        <Info className="h-4 w-4 mt-0.5" />
                                        No payments recorded.
                                    </div>
                                ) : (
                                    (payments || []).map((p) => {
                                        const Icon = modeIcon(p.mode);
                                        const isRefund = Number(p.amount || 0) < 0;
                                        return (
                                            <div key={p.id} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-start gap-2">
                                                        <div className="rounded-2xl border border-slate-200 bg-white p-2">
                                                            <Icon className="h-4 w-4 text-slate-700" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-black text-slate-900">{p.mode}</div>
                                                            <div className="mt-1 text-[11px] text-slate-500">
                                                                {fmtDt(p.paid_at)}
                                                            </div>
                                                            <div className="mt-1 text-[11px] text-slate-600">
                                                                Ref: {p.reference_no || "—"}
                                                            </div>
                                                            <div className="mt-1 text-[11px] text-slate-600">
                                                                Notes: {p.notes || "—"}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="text-[11px] text-slate-500">Amount</div>
                                                        <div className={cls("text-sm font-black", isRefund ? "text-rose-700" : "text-emerald-700")}>
                                                            ₹ {formatMoney(p.amount)}
                                                        </div>
                                                        {!isFinalized ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeletePayment(p)}
                                                                className="mt-2 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700 hover:bg-rose-100"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                Delete
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Desktop tables */}
                            <div className="hidden md:block space-y-4">
                                {/* Payments */}
                                <div className="space-y-2">
                                    <div className="text-[11px] font-black text-slate-800 flex items-center gap-2">
                                        <CreditCard className="h-4 w-4" />
                                        Payments (Positive)
                                    </div>

                                    {positivePayments.length === 0 ? (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-600 flex items-start gap-2">
                                            <Info className="h-4 w-4 mt-0.5" />
                                            No payments recorded.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-slate-100 text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-2 py-2 text-left font-black text-slate-500">Mode</th>
                                                        <th className="px-2 py-2 text-left font-black text-slate-500">Reference</th>
                                                        <th className="px-2 py-2 text-left font-black text-slate-500">Notes</th>
                                                        <th className="px-2 py-2 text-left font-black text-slate-500">Time</th>
                                                        <th className="px-2 py-2 text-right font-black text-slate-500">Amount</th>
                                                        <th className="px-2 py-2"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {positivePayments.map((p) => {
                                                        const Icon = modeIcon(p.mode);
                                                        return (
                                                            <tr key={p.id}>
                                                                <td className="px-2 py-2 text-slate-900 font-black">
                                                                    <span className="inline-flex items-center gap-2">
                                                                        <span className="rounded-xl border border-slate-200 bg-white p-1.5">
                                                                            <Icon className="h-4 w-4 text-slate-700" />
                                                                        </span>
                                                                        {p.mode}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-2 text-slate-600">{p.reference_no || "—"}</td>
                                                                <td className="px-2 py-2 text-slate-600">{p.notes || "—"}</td>
                                                                <td className="px-2 py-2 text-slate-500">
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <CalendarDays className="h-3.5 w-3.5" />
                                                                        {fmtDt(p.paid_at)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-2 text-right text-emerald-700 font-black">
                                                                    ₹ {formatMoney(p.amount)}
                                                                </td>
                                                                <td className="px-2 py-2 text-right">
                                                                    {!isFinalized ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeletePayment(p)}
                                                                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700 hover:bg-rose-100"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                            Delete
                                                                        </button>
                                                                    ) : null}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Refunds */}
                                <div className="space-y-2">
                                    <div className="text-[11px] font-black text-slate-800 flex items-center gap-2">
                                        <Undo2 className="h-4 w-4" />
                                        Refunds (Negative)
                                    </div>

                                    {refundPayments.length === 0 ? (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-600 flex items-start gap-2">
                                            <Info className="h-4 w-4 mt-0.5" />
                                            No refunds recorded.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-slate-100 text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-2 py-2 text-left font-black text-slate-500">Mode</th>
                                                        <th className="px-2 py-2 text-left font-black text-slate-500">Reference</th>
                                                        <th className="px-2 py-2 text-left font-black text-slate-500">Notes</th>
                                                        <th className="px-2 py-2 text-left font-black text-slate-500">Time</th>
                                                        <th className="px-2 py-2 text-right font-black text-slate-500">Amount</th>
                                                        <th className="px-2 py-2"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {refundPayments.map((p) => {
                                                        const Icon = modeIcon(p.mode);
                                                        return (
                                                            <tr key={p.id}>
                                                                <td className="px-2 py-2 text-slate-900 font-black">
                                                                    <span className="inline-flex items-center gap-2">
                                                                        <span className="rounded-xl border border-slate-200 bg-white p-1.5">
                                                                            <Icon className="h-4 w-4 text-slate-700" />
                                                                        </span>
                                                                        {p.mode}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-2 text-slate-600">{p.reference_no || "—"}</td>
                                                                <td className="px-2 py-2 text-slate-600">{p.notes || "—"}</td>
                                                                <td className="px-2 py-2 text-slate-500">
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <CalendarDays className="h-3.5 w-3.5" />
                                                                        {fmtDt(p.paid_at)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-2 text-right text-rose-700 font-black">
                                                                    ₹ {formatMoney(p.amount)}
                                                                </td>
                                                                <td className="px-2 py-2 text-right">
                                                                    {!isFinalized ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeletePayment(p)}
                                                                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700 hover:bg-rose-100"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                            Delete
                                                                        </button>
                                                                    ) : null}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>

            {/* Sticky bottom action bar */}
            <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
                <div className="w-full px-0 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                        <Chip icon={CheckCircle2} label="Net" value={`₹ ${formatMoney(invoice.net_total)}`} tone="indigo" />
                        <Chip icon={Banknote} label="Paid" value={`₹ ${formatMoney(invoice.amount_paid)}`} tone="emerald" />
                        <Chip icon={Wallet} label="Deposit Used" value={`₹ ${formatMoney(invoice.advance_adjusted)}`} tone="emerald" />
                        <Chip icon={MinusCircle} label="Balance" value={`₹ ${formatMoney(invoice.balance_due)}`} tone="rose" />
                    </div>

                    <div className="flex gap-2 justify-end">
                        {!isFinalized ? (
                            <>
                                <ActionBtn
                                    icon={busyAction === "cancel" ? Loader2 : XCircle}
                                    onClick={handleCancel}
                                    disabled={busyAction === "cancel"}
                                >
                                    {busyAction === "cancel" ? "Cancelling…" : "Cancel"}
                                </ActionBtn>

                                <button
                                    type="button"
                                    onClick={handleFinalize}
                                    disabled={busyAction === "finalize"}
                                    className={cls(
                                        "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-black text-white shadow-md transition",
                                        "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:shadow-lg",
                                        "disabled:opacity-60 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {busyAction === "finalize" ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <BadgeCheck className="h-4 w-4" />
                                    )}
                                    {busyAction === "finalize" ? "Finalizing…" : "Finalize"}
                                </button>
                            </>
                        ) : (
                            <div className="text-[11px] text-slate-500 font-bold">
                                Invoice locked: {invoice.status}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Add Item (mobile) */}
            {!isFinalized ? (
                <button
                    type="button"
                    onClick={() => setShowManualForm(true)}
                    className="md:hidden fixed right-4 bottom-24 z-40 h-12 w-12 rounded-2xl bg-slate-900 text-white shadow-xl hover:bg-slate-800 flex items-center justify-center"
                    title="Add Manual Item"
                >
                    <Plus className="h-5 w-5" />
                </button>
            ) : null}

            {/* ---------------- Modals ---------------- */}
            <Modal
                open={showManualForm && !isFinalized}
                title="Add Manual Item"
                icon={PlusCircle}
                onClose={() => setShowManualForm(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowManualForm(false)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            form="manual-item-form"
                            type="submit"
                            className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
                        >
                            Add Item
                        </button>
                    </div>
                }
            >
                <form id="manual-item-form" className="space-y-3" onSubmit={handleAddManualItem}>
                    <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-700">Description</label>
                        <input
                            type="text"
                            name="description"
                            value={manualForm.description}
                            onChange={onManualChange}
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Qty</label>
                            <input
                                type="number"
                                name="quantity"
                                value={manualForm.quantity}
                                min={1}
                                onChange={onManualChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Unit Price</label>
                            <input
                                type="number"
                                name="unit_price"
                                value={manualForm.unit_price}
                                step="0.01"
                                onChange={onManualChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Tax %</label>
                            <input
                                type="number"
                                name="tax_rate"
                                value={manualForm.tax_rate}
                                step="0.1"
                                onChange={onManualChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Disc %</label>
                            <input
                                type="number"
                                name="discount_percent"
                                value={manualForm.discount_percent}
                                step="0.1"
                                onChange={onManualChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Disc Amt</label>
                            <input
                                type="number"
                                name="discount_amount"
                                value={manualForm.discount_amount}
                                step="0.01"
                                onChange={onManualChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </form>
            </Modal>

            <Modal
                open={!!editingItemId && !isFinalized}
                title="Edit Item"
                icon={Pencil}
                onClose={() => setEditingItemId(null)}
                footer={
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            form="edit-item-form"
                            type="submit"
                            className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
                        >
                            Save
                        </button>
                    </div>
                }
            >
                <form id="edit-item-form" className="space-y-3" onSubmit={handleUpdateItem}>
                    <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-700">Description</label>
                        <input
                            type="text"
                            name="description"
                            value={itemForm.description}
                            onChange={onItemChange}
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Qty</label>
                            <input
                                type="number"
                                name="quantity"
                                value={itemForm.quantity}
                                min={1}
                                onChange={onItemChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Unit Price</label>
                            <input
                                type="number"
                                name="unit_price"
                                value={itemForm.unit_price}
                                step="0.01"
                                onChange={onItemChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Tax %</label>
                            <input
                                type="number"
                                name="tax_rate"
                                value={itemForm.tax_rate}
                                step="0.1"
                                onChange={onItemChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Disc %</label>
                            <input
                                type="number"
                                name="discount_percent"
                                value={itemForm.discount_percent}
                                step="0.1"
                                onChange={onItemChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Disc Amt</label>
                            <input
                                type="number"
                                name="discount_amount"
                                value={itemForm.discount_amount}
                                step="0.01"
                                onChange={onItemChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </form>
            </Modal>

            <Modal
                open={showPaymentForm && !isFinalized}
                title={paymentKind === "refund" ? "Add Refund" : "Add Payment"}
                icon={paymentKind === "refund" ? Undo2 : CreditCard}
                onClose={() => {
                    setShowPaymentForm(false);
                    setPaymentKind("payment");
                }}
                footer={
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowPaymentForm(false);
                                setPaymentKind("payment");
                            }}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            form="payment-form"
                            type="submit"
                            className={cls(
                                "rounded-2xl px-4 py-2 text-xs font-black text-white",
                                paymentKind === "refund"
                                    ? "bg-rose-600 hover:bg-rose-700"
                                    : "bg-indigo-600 hover:bg-indigo-700"
                            )}
                        >
                            {paymentKind === "refund" ? "Save Refund" : "Save Payment"}
                        </button>
                    </div>
                }
            >
                <form id="payment-form" className="space-y-3" onSubmit={handleAddPayment}>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Amount</label>
                            <input
                                type="number"
                                name="amount"
                                value={paymentForm.amount}
                                onChange={onPaymentChange}
                                step="0.01"
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                            <div className="text-[10px] text-slate-500">
                                {paymentKind === "refund"
                                    ? "Refund will be saved as negative amount."
                                    : "Payment is saved as positive amount."}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-slate-700">Mode</label>
                            <select
                                name="mode"
                                value={paymentForm.mode}
                                onChange={onPaymentChange}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="upi">UPI</option>
                                <option value="credit">Credit</option>
                                <option value="cheque">Cheque</option>
                                <option value="neft/rtgs">NEFT/RTGS</option>
                                <option value="wallet">Wallet</option>
                                <option value="refund">Refund</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-700">Reference No</label>
                        <input
                            type="text"
                            name="reference_no"
                            value={paymentForm.reference_no}
                            onChange={onPaymentChange}
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-700">Notes</label>
                        <input
                            type="text"
                            name="notes"
                            value={paymentForm.notes}
                            onChange={onPaymentChange}
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </form>
            </Modal>

            <Modal
                open={showWalletApply && !isFinalized}
                title="Apply Advance / Deposit"
                icon={Wallet}
                onClose={() => setShowWalletApply(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowWalletApply(false)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            form="wallet-apply-form"
                            type="submit"
                            disabled={walletApplying}
                            className={cls(
                                "rounded-2xl px-4 py-2 text-xs font-black text-white",
                                walletApplying ? "bg-slate-400" : "bg-emerald-600 hover:bg-emerald-700"
                            )}
                        >
                            {walletApplying ? "Applying…" : "Apply"}
                        </button>
                    </div>
                }
            >
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-3 text-xs">
                    <div className="flex justify-between">
                        <span className="text-slate-700 font-bold">Available Deposit</span>
                        <span className="font-black text-emerald-800">₹ {formatMoney(walletAvailable)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="text-slate-700 font-bold">Invoice Balance Due</span>
                        <span className="font-black text-slate-900">₹ {formatMoney(invoice.balance_due)}</span>
                    </div>
                </div>

                <form id="wallet-apply-form" onSubmit={handleWalletApplySubmit} className="space-y-3 mt-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-700">Apply Amount</label>
                        <input
                            type="number"
                            value={walletApplyAmt}
                            onChange={(e) => setWalletApplyAmt(e.target.value)}
                            step="0.01"
                            min="0"
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="Enter amount to apply"
                            required
                        />
                        <div className="text-[10px] text-slate-500">
                            Cannot exceed available deposit or balance due.
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Unbilled Drawer */}
            <Drawer
                open={showUnbilled}
                title="Unbilled Services"
                subtitle="Select and bulk add into this invoice"
                onClose={() => setShowUnbilled(false)}
                width="sm:w-[640px]"
                footer={
                    <div className="flex items-center justify-between">
                        <div className="text-[11px] text-slate-500">
                            {Object.keys(unbilledSelected).filter((k) => unbilledSelected[k]).length} selected
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowUnbilled(false)}
                                className="px-4 py-2 rounded-2xl border border-slate-200 text-xs font-black bg-white hover:bg-slate-50"
                            >
                                Close
                            </button>
                            <button
                                onClick={addSelectedUnbilled}
                                disabled={busyAction === "unbilled"}
                                className={cls(
                                    "px-4 py-2 rounded-2xl text-xs font-black text-white",
                                    busyAction === "unbilled"
                                        ? "bg-slate-400"
                                        : "bg-indigo-600 hover:bg-indigo-700"
                                )}
                            >
                                {busyAction === "unbilled" ? "Adding…" : "Add Selected"}
                            </button>
                        </div>
                    </div>
                }
            >
                {unbilledLoading ? (
                    <div className="p-4 text-xs text-slate-500 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                    </div>
                ) : (unbilled || []).length === 0 ? (
                    <div className="p-4 text-xs text-slate-500">No unbilled services.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {(unbilled || []).map((u) => {
                            const key = String(
                                u.uid || `${u.service_type || "svc"}-${u.ref_id || u.id || "x"}`
                            );
                            return (
                                <div key={key} className="p-4 flex gap-3">
                                    <input
                                        type="checkbox"
                                        checked={!!unbilledSelected[key]}
                                        onChange={() => toggleUnbilled(key)}
                                        className="mt-1"
                                    />
                                    <div className="min-w-0">
                                        <div className="text-xs font-black text-slate-900 truncate">
                                            {u.title || u.description || `${u.service_type} #${u.ref_id}`}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            {u.service_type} • Ref #{u.ref_id} • ₹ {formatMoney(u.amount || 0)}
                                        </div>
                                        {u.meta ? (
                                            <div className="text-[11px] text-slate-500">
                                                {String(u.meta)}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Drawer>
        </div>
    );
}
