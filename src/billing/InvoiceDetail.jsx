// FILE: src/pages/InvoiceDetail.jsx
import { useEffect, useMemo, useState, Fragment } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import {
    getInvoice,
    updateInvoice,
    addManualItem,
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
    Search,
    
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

/* ---------------- hospital warm theme ---------------- */
const H = {
    page: "bg-[#F0F0F0] text-[#071952]",
    card: "bg-[#FFFEFB]",
    soft: "bg-[#F6EFE6]",
    soft2: "bg-[#FBF7F1]",
    border: "border-[#D9CBB8]",
    borderSoft: "border-[#E7DBCD]",
    muted: "text-[#6B5E55]",
    text: "text-[#2B2118]",
    shadow: "shadow-[0_10px_24px_rgba(43,33,24,0.10)]",
    shadowSm: "shadow-[0_6px_14px_rgba(43,33,24,0.10)]",
    focus:
        "focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-[#BDAA95]",

    // buttons (premium dark)
    btnPrimary: "bg-[#0E2954] hover:bg-[#1F1712] text-white",
    btnSecondary: "bg-[#ECF8F9] hover:bg-[#F6EFE6] text-[#2B2118]",
    btnDanger: "bg-[#8B2C2C] hover:bg-[#742424] text-white",
    btnSoftDanger:
        "bg-[#068DA9] hover:bg-[#F6D7D3] text-[#ECF8F9] border-[#E7B3AE]",
    btnSoftSuccess:
        "bg-[#E7F3EC] hover:bg-[#D9EDE3] text-[#1E5A3C] border-[#B9D8C6]",
    btnSoftAmber:
        "bg-[#068DA9] hover:bg-[#F7E7C7] text-[#6B3F0A] border-[#E9C997]",

    // tables
    th: "text-[11px] font-bold tracking-wide uppercase text-[#6B5E55]",
    td: "text-[12px] text-[#2B2118]",
    rowHover: "hover:bg-[#F6EFE6]",
    zebraA: "bg-[#FFFEFB]",
    zebraB: "bg-[#FBF7F1]",
};

/* ---------------- status + icons ---------------- */
function statusPill(status) {
    const s = String(status || "").toLowerCase();
    if (s === "finalized")
        return "bg-[#E7F3EC] text-[#1E5A3C] border-[#B9D8C6]";
    if (s === "cancelled")
        return "bg-[#FBE9E7] text-[#7A1F1B] border-[#E7B3AE]";
    return "bg-[#FFF3D9] text-[#6B3F0A] border-[#E9C997]";
}
function statusIcon(status) {
    const s = String(status || "").toLowerCase();
    if (s === "finalized") return BadgeCheck;
    if (s === "cancelled") return XCircle;
    return Clock;
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

/* ---------------- classic hospital UI atoms ---------------- */
function Panel({ className = "", children }) {
    return (
        <div
            className={cls(
                "rounded-2xl border",
                H.border,
                H.card,
                H.shadowSm,
                className
            )}
        >
            {children}
        </div>
    );
}

function SectionHeader({ icon: Icon, title, subtitle, right }) {
    return (
        <div
            className={cls(
                "flex items-center justify-between gap-2 px-4 py-3 border-b",
                H.borderSoft,
                H.soft
            )}
        >
            <div className="flex items-center gap-2 min-w-0">
                {Icon ? (
                    <div
                        className={cls(
                            "h-9 w-9 rounded-xl border bg-white flex items-center justify-center",
                            H.borderSoft
                        )}
                    >
                        <Icon className="h-4 w-4 text-[#2B2118]" />
                    </div>
                ) : null}
                <div className="min-w-0">
                    <div className="text-[13px] md:text-[14px] font-semibold text-[#2B2118] truncate">
                        {title}
                    </div>
                    {subtitle ? (
                        <div className={cls("text-[11px]", H.muted)}>{subtitle}</div>
                    ) : null}
                </div>
            </div>
            {right}
        </div>
    );
}

function Chip({ icon: Icon, label, value, tone = "slate" }) {
    const toneMap = {
        slate: `border ${H.borderSoft} bg-[#FFFEFB] text-[#2B2118]`,
        emerald: "bg-[#E7F3EC] text-[#1E5A3C] border-[#B9D8C6]",
        indigo: "bg-[#F6EFE6] text-[#2B2118] border-[#D9CBB8]",
        rose: "bg-[#FBE9E7] text-[#7A1F1B] border-[#E7B3AE]",
        amber: "bg-[#FFF3D9] text-[#6B3F0A] border-[#E9C997]",
    };
    return (
        <div
            className={cls(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold",
                toneMap[tone] || toneMap.slate
            )}
        >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span className={cls("font-semibold", H.muted)}>{label}</span>
            <span className={cls("font-bold", H.text)}>{value}</span>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, tone = "slate" }) {
    const toneBg = {
        slate: H.card,
        indigo: "bg-[#F6EFE6]",
        emerald: "bg-[#E7F3EC]",
        rose: "bg-[#FBE9E7]",
        amber: "bg-[#FFF3D9]",
    };
    const toneBorder = {
        slate: H.border,
        indigo: "border-[#D9CBB8]",
        emerald: "border-[#B9D8C6]",
        rose: "border-[#E7B3AE]",
        amber: "border-[#E9C997]",
    };
    return (
        <div
            className={cls(
                "rounded-2xl border p-3",
                toneBorder[tone] || H.border,
                toneBg[tone] || H.card,
                H.shadowSm
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <div className={cls("text-[11px] font-bold tracking-wide uppercase", H.muted)}>
                    {label}
                </div>
                {Icon ? (
                    <div
                        className={cls(
                            "h-9 w-9 rounded-xl border bg-white flex items-center justify-center",
                            H.borderSoft
                        )}
                    >
                        <Icon className="h-4 w-4 text-[#2B2118]" />
                    </div>
                ) : null}
            </div>
            <div className={cls("mt-2 text-[15px] font-semibold", H.text)}>{value}</div>
        </div>
    );
}

function Button({ variant = "secondary", icon: Icon, children, className = "", ...props }) {
    const map = {
        primary: cls("border border-[#1F1712]", H.btnPrimary),
        secondary: cls("border", H.border, H.btnSecondary),
        danger: cls("border border-[#742424]", H.btnDanger),
        softDanger: cls("border", H.btnSoftDanger),
        softSuccess: cls("border", H.btnSoftSuccess),
        softAmber: cls("border", H.btnSoftAmber),
    };
    return (
        <button
            {...props}
            className={cls(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold transition shadow-sm whitespace-nowrap",
                map[variant] || map.secondary,
                "disabled:opacity-60 disabled:cursor-not-allowed",
                className
            )}
        >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {children}
        </button>
    );
}

function IconButton({ title, onClick, disabled, icon: Icon, className = "" }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
            className={cls(
                "h-9 w-9 rounded-xl border grid place-items-center shadow-sm transition",
                H.border,
                H.btnSecondary,
                "disabled:opacity-60 disabled:cursor-not-allowed",
                className
            )}
        >
            {Icon ? <Icon className="h-4 w-4" /> : null}
        </button>
    );
}

function Field({ label, children, hint }) {
    return (
        <div className="space-y-1">
            <label className={cls("text-[11px] font-bold tracking-wide uppercase", H.muted)}>
                {label}
            </label>
            {children}
            {hint ? <div className={cls("text-[11px]", H.muted)}>{hint}</div> : null}
        </div>
    );
}

function Input({ className = "", ...props }) {
    return (
        <input
            {...props}
            className={cls(
                "w-full rounded-xl border px-3 py-2 text-xs",
                H.border,
                "bg-white text-[#2B2118] placeholder:text-[#8A7B70]",
                H.focus,
                "disabled:bg-[#F6EFE6] disabled:cursor-not-allowed",
                className
            )}
        />
    );
}

function Select({ className = "", children, ...props }) {
    return (
        <select
            {...props}
            className={cls(
                "w-full rounded-xl border px-3 py-2 text-xs",
                H.border,
                "bg-white text-[#2B2118]",
                H.focus,
                "disabled:bg-[#F6EFE6] disabled:cursor-not-allowed",
                className
            )}
        >
            {children}
        </select>
    );
}

function CopyBtn({ value, label = "Copy" }) {
    return (
        <Button
            variant="secondary"
            icon={Copy}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(String(value || ""));
                    toast.success("Copied");
                } catch {
                    toast.error("Copy failed");
                }
            }}
            title="Copy"
        >
            {label}
        </Button>
    );
}

/* ----------- small UI helpers ----------- */
function CollapseToggle({ open, onClick }) {
    return (
        <Button variant="secondary" icon={open ? ChevronUp : ChevronDown} onClick={onClick}>
            {open ? "Collapse" : "Expand"}
        </Button>
    );
}

function ColumnPicker({ title = "Columns", value, onChange }) {
    const entries = Object.entries(value || {});
    return (
        <details className="relative">
            <summary className="list-none">
                <Button variant="secondary" icon={Layers} className="cursor-pointer">
                    {title}
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
            </summary>

            <div className={cls("absolute right-0 mt-2 w-60 rounded-2xl border p-2 z-20", H.border, H.card, H.shadow)}>
                <div className={cls("px-2 py-1 text-[11px] font-bold tracking-wide uppercase", H.muted)}>
                    Toggle columns
                </div>
                <div className="mt-1 space-y-1">
                    {entries.map(([k, v]) => (
                        <label key={k} className={cls("flex items-center gap-2 px-2 py-1 rounded-xl cursor-pointer", H.rowHover)}>
                            <input
                                type="checkbox"
                                checked={!!v}
                                onChange={(e) => onChange({ ...value, [k]: e.target.checked })}
                            />
                            <span className="text-[12px] text-[#2B2118]">{k}</span>
                        </label>
                    ))}
                </div>
            </div>
        </details>
    );
}

/* ---------------- Modal / Drawer (classic) ---------------- */
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

    return (
        <AnimatePresence>
            {open ? (
                <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="absolute inset-0 bg-black/45" onClick={onClose} />
                    <div className="absolute inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6">
                        <motion.div
                            initial={{ y: 24, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 24, opacity: 0 }}
                            transition={{ type: "tween", duration: 0.16 }}
                            className={cls("w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border shadow-2xl", H.border, "bg-[#FFFEFB]")}
                        >
                            <div className={cls("flex items-center justify-between px-4 sm:px-6 py-3 border-b", H.borderSoft, H.soft)}>
                                <div className="flex items-center gap-2">
                                    {Icon ? (
                                        <div className={cls("h-9 w-9 rounded-xl border bg-white flex items-center justify-center", H.borderSoft)}>
                                            <Icon className="h-4 w-4 text-[#2B2118]" />
                                        </div>
                                    ) : null}
                                    <div>
                                        <h3 className="text-[14px] font-semibold text-[#2B2118]">{title}</h3>
                                        <div className={cls("text-[11px]", H.muted)}>Press Esc to close</div>
                                    </div>
                                </div>
                                <IconButton title="Close" onClick={onClose} icon={X} />
                            </div>

                            <div className="px-4 sm:px-6 py-4 max-h-[70vh] overflow-auto">{children}</div>

                            {footer ? (
                                <div className={cls("px-4 sm:px-6 py-3 border-t", H.borderSoft, H.soft)}>{footer}</div>
                            ) : null}
                        </motion.div>
                    </div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}

function Drawer({ open, title, subtitle, onClose, children, footer, width = "sm:w-[720px]" }) {
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

    return (
        <AnimatePresence>
            {open ? (
                <motion.div className="fixed inset-0 z-[55]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="absolute inset-0 bg-black/45" onClick={onClose} />
                    <motion.div
                        className={cls("absolute right-0 top-0 h-full w-full border-l bg-[#FFFEFB] shadow-2xl flex flex-col", width, H.border)}
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 40, opacity: 0 }}
                        transition={{ type: "tween", duration: 0.16 }}
                    >
                        <div className={cls("p-4 border-b", H.borderSoft, H.soft, "flex items-center justify-between")}>
                            <div>
                                <h3 className="text-[14px] font-semibold text-[#2B2118]">{title}</h3>
                                {subtitle ? <div className={cls("text-[11px]", H.muted)}>{subtitle}</div> : null}
                            </div>
                            <IconButton title="Close" onClick={onClose} icon={X} />
                        </div>

                        <div className="flex-1 overflow-auto">{children}</div>

                        {footer ? <div className={cls("p-4 border-t", H.borderSoft, H.soft2)}>{footer}</div> : null}
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
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

    // section collapse
    const [summaryOpen, setSummaryOpen] = useState(true);
    const [headerOpen, setHeaderOpen] = useState(true);
    const [depositOpen, setDepositOpen] = useState(true);
    const [itemsOpen, setItemsOpen] = useState(true);
    const [paymentsOpen, setPaymentsOpen] = useState(true);

    // filter/search
    const [itemQuery, setItemQuery] = useState("");
    const [showVoided, setShowVoided] = useState(false);
    const [payQuery, setPayQuery] = useState("");

    // row expand
    const [expandedItems, setExpandedItems] = useState({});
    const [expandedPays, setExpandedPays] = useState({});

    // column toggles (labels are keys)
    const [itemCols, setItemCols] = useState({
        "#": true,
        Description: true,
        "Service Ref": false,
        Qty: true,
        Price: true,
        "GST %": false,
        Discount: false,
        Total: true,
        Actions: true,
    });
    const [payCols, setPayCols] = useState({
        Mode: true,
        Reference: true,
        Notes: false,
        Time: true,
        Amount: true,
        Actions: true,
    });

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
        if (next && typeof next === "object" && (next.id || next.items || next.payments)) {
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
                consultant_id: headerForm.consultant_id ? Number(headerForm.consultant_id) : null,
                provider_id: headerForm.provider_id ? Number(headerForm.provider_id) : null,
                visit_no: headerForm.visit_no || null,
                remarks: headerForm.remarks || null,
                header_discount_percent:
                    headerForm.header_discount_percent !== "" && headerForm.header_discount_percent !== null
                        ? Number(headerForm.header_discount_percent)
                        : null,
                header_discount_amount:
                    headerForm.header_discount_amount !== "" && headerForm.header_discount_amount !== null
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
                    manualForm.discount_amount !== "" ? Number(manualForm.discount_amount || 0) : undefined,
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
                name === "quantity" || name === "tax_rate" || name === "discount_percent"
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
                    itemForm.discount_amount !== "" ? Number(itemForm.discount_amount || 0) : undefined,
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
        setPaymentForm((p) => ({ ...p, mode: kind === "refund" ? "refund" : "cash" }));
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

    async function handleWalletApplySubmit(e) {
        e.preventDefault();
        if (!invoice) return;

        const available = Number(walletSummary?.available_advance ?? walletSummary?.available ?? 0);
        const amt = Number(walletApplyAmt || 0);

        if (!amt || amt <= 0) return setError("Enter a valid amount to apply.");
        if (amt > available) return setError("Apply amount cannot exceed available deposit.");
        if (amt > Number(invoice.balance_due || 0))
            return setError("Apply amount cannot exceed invoice balance due.");

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

    const filteredItems = useMemo(() => {
        const q = itemQuery.trim().toLowerCase();
        return (items || []).filter((it) => {
            if (!showVoided && it.is_voided) return false;
            if (!q) return true;
            const blob = `${it.description || ""} ${it.service_type || ""} ${it.service_ref_id || ""}`.toLowerCase();
            return blob.includes(q);
        });
    }, [items, itemQuery, showVoided]);

    const filteredPayments = useMemo(() => {
        const q = payQuery.trim().toLowerCase();
        if (!q) return payments || [];
        return (payments || []).filter((p) => {
            const blob = `${p.mode || ""} ${p.reference_no || ""} ${p.notes || ""} ${fmtDt(p.paid_at)}`.toLowerCase();
            return blob.includes(q);
        });
    }, [payments, payQuery]);

    // ✅ Correct colspans (expander column + visible columns)
    const itemColSpan = useMemo(() => 1 + Object.values(itemCols).filter(Boolean).length, [itemCols]);
    const payColSpan = useMemo(() => 1 + Object.values(payCols).filter(Boolean).length, [payCols]);

    const PAGE = "max-w-[96rem] mx-auto";
    const invTitle = `Invoice #${invoice?.invoice_number || invoice?.id || ""}`;

    if (loading) {
        return (
            <div className={cls("min-h-[calc(100vh-4rem)] px-3 md:px-6 py-8", H.page)}>
                <div className={cls(PAGE, "flex items-center gap-2 text-xs", H.muted)}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading invoice…
                </div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className={cls("min-h-[calc(100vh-4rem)] px-3 md:px-6 py-8", H.page)}>
                <div className={PAGE}>
                    <Panel className="p-4 border-[#E7B3AE] bg-[#FBE9E7]">
                        <div className="text-xs text-[#7A1F1B] flex items-start gap-2">
                            <ShieldAlert className="h-4 w-4 mt-0.5" />
                            <div>{error || "Invoice not found."}</div>
                        </div>
                    </Panel>

                    <div className="mt-4">
                        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate("/billing")}>
                            Back to Billing Console
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const StatusIco = statusIcon(invoice.status);

    return (
        <div className={cls("min-h-[calc(100vh-4rem)]", H.page)}>
            {/* Sticky Header */}
            <div className={cls("sticky top-0 z-40 border-b", H.border, "bg-[#FBF7F1]")}>
                <div className={cls(PAGE, "px-3 md:px-6 py-3 flex items-center justify-between gap-3")}>
                    <div className="flex items-center gap-3 min-w-0">
                        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate("/billing")}>
                            Billing
                        </Button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <h3 className="text-[15px] md:text-[16px] font-semibold text-[#2B2118] truncate">
                                    {invTitle}
                                </h3>
                                <span className={cls("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold", statusPill(invoice.status))}>
                                    <StatusIco className="h-4 w-4" />
                                    {String(invoice.status || "").toUpperCase()}
                                </span>
                            </div>

                            <div className={cls("mt-1 flex flex-wrap gap-3 text-[11px]", H.muted)}>
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
                        <Button variant="secondary" icon={Layers} onClick={openUnbilled}>
                            Unbilled
                        </Button>
                        <Button variant="secondary" icon={Printer} onClick={handlePrint}>
                            Print
                        </Button>
                        <CopyBtn value={invoice.invoice_number || invoice.id} label="Copy ID" />
                    </div>
                </div>
            </div>

            <div className={cls(PAGE, "px-3 md:px-6 py-4 space-y-4")}>
                {error ? (
                    <Panel className="p-4 border-[#E7B3AE] bg-[#FBE9E7]">
                        <div className="text-xs text-[#7A1F1B] flex items-start gap-2">
                            <ShieldAlert className="h-4 w-4 mt-0.5" />
                            <div>{error}</div>
                        </div>
                    </Panel>
                ) : null}

                {/* Summary */}
                <Panel>
                    <SectionHeader
                        icon={Receipt}
                        title="Patient & Totals"
                        subtitle="Billing summary for current invoice"
                        right={<CollapseToggle open={summaryOpen} onClick={() => setSummaryOpen((v) => !v)} />}
                    />

                    {summaryOpen ? (
                        <div className="p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="space-y-2 min-w-0">
                                    <div className="flex flex-wrap gap-2">
                                        <Chip icon={Hash} label="Patient ID" value={`#${invoice.patient_id}`} />
                                        {patientSummary?.patient?.uhid ? (
                                            <Chip icon={FileText} label="UHID" value={patientSummary.patient.uhid} tone="indigo" />
                                        ) : null}
                                        {patientSummary?.patient?.phone ? (
                                            <Chip icon={HandCoins} label="Phone" value={patientSummary.patient.phone} />
                                        ) : null}
                                    </div>

                                    {patientSummary?.patient?.name ? (
                                        <div className="text-[12px] text-[#2B2118] truncate">
                                            {patientSummary.patient.name}
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

                                    <Button
                                        variant="secondary"
                                        icon={PlusCircle}
                                        onClick={() => navigate(`/billing/advance?patient_id=${invoice.patient_id}`)}
                                        title="Open patient deposit page"
                                    >
                                        Add Deposit
                                    </Button>

                                    <Button
                                        variant="softSuccess"
                                        icon={Wallet}
                                        onClick={() => setShowWalletApply(true)}
                                        disabled={walletAvailable <= 0 || isFinalized}
                                        title="Use patient deposit (advance) for this invoice"
                                    >
                                        Use Deposit
                                    </Button>

                                    <Button
                                        variant="secondary"
                                        icon={FileDown}
                                        onClick={handleCreditSummaryPdf}
                                        disabled={loadingSummary}
                                    >
                                        {loadingSummary ? "Loading…" : "Credit Summary PDF"}
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                <StatCard icon={Receipt} label="Gross" value={`₹ ${formatMoney(invoice.gross_total)}`} />
                                <StatCard icon={FileText} label="Tax" value={`₹ ${formatMoney(invoice.tax_total)}`} />
                                <StatCard icon={CheckCircle2} label="Net" value={`₹ ${formatMoney(invoice.net_total)}`} tone="indigo" />
                                <StatCard icon={MinusCircle} label="Balance Due" value={`₹ ${formatMoney(invoice.balance_due)}`} tone="rose" />
                            </div>
                        </div>
                    ) : (
                        <div className={cls("p-4 text-xs flex items-start gap-2", H.muted)}>
                            <Info className="h-4 w-4 mt-0.5" />
                            Summary is collapsed.
                        </div>
                    )}
                </Panel>

                {/* Main grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left */}
                    <div className="lg:col-span-5 space-y-4">
                        {/* Header */}
                        <Panel>
                            <SectionHeader
                                icon={Receipt}
                                title="Invoice Header"
                                subtitle="Billing type, consultant, credit provider, remarks"
                                right={
                                    <div className="flex items-center gap-2">
                                        <CollapseToggle open={headerOpen} onClick={() => setHeaderOpen((v) => !v)} />
                                        {!isFinalized ? (
                                            <Button
                                                variant="primary"
                                                icon={savingHeader ? Loader2 : CheckCircle2}
                                                onClick={handleSaveHeader}
                                                disabled={savingHeader}
                                            >
                                                {savingHeader ? "Saving…" : "Save"}
                                            </Button>
                                        ) : (
                                            <span className={cls("text-[12px] font-semibold", H.muted)}>Locked</span>
                                        )}
                                    </div>
                                }
                            />

                            {headerOpen ? (
                                <div className="p-4 space-y-3">
                                    <Field label="Billing Type">
                                        <Select name="billing_type" value={headerForm.billing_type} onChange={onHeaderChange} disabled={isFinalized}>
                                            <option value="op_billing">OP Billing</option>
                                            <option value="ip_billing">IP Billing</option>
                                            <option value="ot">OT</option>
                                            <option value="lab">Lab</option>
                                            <option value="pharmacy">Pharmacy</option>
                                            <option value="radiology">Radiology</option>
                                            <option value="general">General</option>
                                        </Select>
                                    </Field>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Consultant">
                                            <Select name="consultant_id" value={headerForm.consultant_id} onChange={onHeaderChange} disabled={isFinalized}>
                                                <option value="">None</option>
                                                {masters.doctors?.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name || `Doctor #${d.id}`}
                                                    </option>
                                                ))}
                                            </Select>
                                        </Field>

                                        <Field label="Credit Provider">
                                            <Select name="provider_id" value={headerForm.provider_id} onChange={onHeaderChange} disabled={isFinalized}>
                                                <option value="">Self pay</option>
                                                {masters.credit_providers?.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.display_name || p.name || p.code || `Provider #${p.id}`}
                                                    </option>
                                                ))}
                                            </Select>
                                        </Field>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Visit No">
                                            <Input type="text" name="visit_no" value={headerForm.visit_no} onChange={onHeaderChange} disabled={isFinalized} />
                                        </Field>
                                        <Field label="Remarks">
                                            <Input type="text" name="remarks" value={headerForm.remarks} onChange={onHeaderChange} disabled={isFinalized} />
                                        </Field>
                                    </div>

                                    {/* Discount */}
                                    <Panel className="shadow-none">
                                        <SectionHeader icon={IndianRupee} title="Header Discount" subtitle="Optional discount at invoice header" />
                                        <div className="p-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <Field label="Discount %">
                                                    <Input
                                                        type="number"
                                                        name="header_discount_percent"
                                                        value={headerForm.header_discount_percent}
                                                        onChange={onHeaderChange}
                                                        disabled={isFinalized}
                                                        step="0.1"
                                                    />
                                                </Field>
                                                <Field label="Discount Amount">
                                                    <Input
                                                        type="number"
                                                        name="header_discount_amount"
                                                        value={headerForm.header_discount_amount}
                                                        onChange={onHeaderChange}
                                                        disabled={isFinalized}
                                                        step="0.01"
                                                    />
                                                </Field>
                                            </div>

                                            <div className="mt-3">
                                                <Field label="Discount Remarks">
                                                    <Input
                                                        type="text"
                                                        name="discount_remarks"
                                                        value={headerForm.discount_remarks}
                                                        onChange={onHeaderChange}
                                                        disabled={isFinalized}
                                                    />
                                                </Field>
                                            </div>
                                        </div>
                                    </Panel>

                                    {activePackages.length > 0 ? (
                                        <Panel className="shadow-none">
                                            <SectionHeader icon={Package} title="Package Billing (IPD)" subtitle="Quick add a package charge to this invoice" />
                                            <div className="p-4">
                                                <Select onChange={(e) => handleAddPackageCharge(e.target.value)} disabled={isFinalized} defaultValue="">
                                                    <option value="">Select package…</option>
                                                    {activePackages.map((pkg) => (
                                                        <option key={pkg.id} value={pkg.id}>
                                                            {pkg.name} — ₹ {formatMoney(pkg.charges)}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </div>
                                        </Panel>
                                    ) : null}
                                </div>
                            ) : (
                                <div className={cls("p-4 text-xs flex items-start gap-2", H.muted)}>
                                    <Info className="h-4 w-4 mt-0.5" />
                                    Header collapsed.
                                </div>
                            )}
                        </Panel>

                        {/* Deposit */}
                        <Panel>
                            <SectionHeader
                                icon={Wallet}
                                title="Deposit Adjustments"
                                subtitle="Advance / Deposit usage in this invoice"
                                right={<CollapseToggle open={depositOpen} onClick={() => setDepositOpen((v) => !v)} />}
                            />

                            {depositOpen ? (
                                <div className="p-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard icon={Wallet} label="Deposit Available" value={`₹ ${walletLoading ? "…" : formatMoney(walletAvailable)}`} tone="emerald" />
                                        <StatCard icon={Wallet} label="Deposit Used" value={`₹ ${formatMoney(depositUsed)}`} tone="indigo" />
                                    </div>

                                    <div className={cls("mt-3 rounded-2xl border p-3", H.border, H.soft2)}>
                                        <div className={cls("text-[11px] font-bold tracking-wide uppercase flex items-center gap-2", H.muted)}>
                                            <Info className="h-4 w-4" />
                                            Adjustment rows (optional)
                                        </div>

                                        <div className="mt-2">
                                            {advanceAdjustments ? (
                                                advanceAdjustments.length === 0 ? (
                                                    <div className={cls("text-[12px]", H.muted)}>No adjustment rows.</div>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className={cls("w-full min-w-[520px] text-xs border border-collapse table-fixed", H.border)}>
                                                            <thead className={cls(H.soft, "border-b", H.border)}>
                                                                <tr>
                                                                    <th className={cls("px-3 py-2 text-left w-[140px]", H.th)}>Advance ID</th>
                                                                    <th className={cls("px-3 py-2 text-left", H.th)}>Applied At</th>
                                                                    <th className={cls("px-3 py-2 text-right w-[140px]", H.th)}>Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {advanceAdjustments.map((a, i) => (
                                                                    <tr
                                                                        key={a.id || `${a.advance_id}-${a.applied_at}-${i}`}
                                                                        className={cls(i % 2 ? H.zebraB : H.zebraA, "border-b", H.borderSoft)}
                                                                    >
                                                                        <td className={cls("px-3 py-2", H.td)}>#{a.advance_id}</td>
                                                                        <td className={cls("px-3 py-2", H.td)}>{fmtDt(a.applied_at)}</td>
                                                                        <td className={cls("px-3 py-2 text-right font-semibold", H.text)}>
                                                                            ₹ {formatMoney(a.amount_applied)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )
                                            ) : (
                                                <div className={cls("rounded-xl border p-3 text-[12px]", H.border, H.card)}>
                                                    Total adjusted: <span className="font-semibold text-[#2B2118]">₹ {formatMoney(depositUsed)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className={cls("p-4 text-xs flex items-start gap-2", H.muted)}>
                                    <Info className="h-4 w-4 mt-0.5" />
                                    Deposit section collapsed.
                                </div>
                            )}
                        </Panel>
                    </div>

                    {/* Right */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Items */}
                        <Panel>
                            <SectionHeader
                                icon={FileText}
                                title="Items"
                                subtitle="Services and manual items billed in this invoice"
                                right={
                                    <div className="flex flex-wrap items-center gap-2 justify-end">
                                        <CollapseToggle open={itemsOpen} onClick={() => setItemsOpen((v) => !v)} />
                                      
                                        {!isFinalized ? (
                                            <Button variant="primary" icon={Plus} onClick={() => setShowManualForm(true)}>
                                                Add Manual
                                            </Button>
                                        ) : (
                                            <span className={cls("text-[12px] font-semibold", H.muted)}>Locked</span>
                                        )}
                                    </div>
                                }
                            />

                            {itemsOpen ? (
                                <div className="p-4">
                                    {/* search + void toggle */}
                                    <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
                                        <div className={cls("flex-1 rounded-xl border px-3 py-2 flex items-center gap-2", H.border, H.card)}>
                                            <Search className="h-4 w-4 text-[#6B5E55]" />
                                            <input
                                                value={itemQuery}
                                                onChange={(e) => setItemQuery(e.target.value)}
                                                className="bg-transparent outline-none text-xs w-full text-[#2B2118] placeholder:text-[#8A7B70]"
                                                placeholder="Search items by description / service / ref…"
                                            />
                                        </div>

                                        <Button
                                            variant={showVoided ? "softDanger" : "secondary"}
                                            onClick={() => setShowVoided((v) => !v)}
                                            title="Toggle voided"
                                        >
                                            {showVoided ? "Showing Voided" : "Hide Voided"}
                                        </Button>
                                    </div>

                                    {filteredItems.length === 0 ? (
                                        <div className={cls("rounded-2xl border p-4 text-xs flex items-start gap-2", H.border, H.soft2, H.muted)}>
                                            <Info className="h-4 w-4 mt-0.5" />
                                            {items.length === 0 ? "No items added yet." : "No items match your search / filter."}
                                        </div>
                                    ) : (
                                        <>
                                            {/* ✅ Desktop table (alignment fixed) */}
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className={cls("w-full min-w-[980px] text-xs border border-collapse table-fixed", H.border)}>
                                                    <thead className={cls(H.soft, "border-b", H.border)}>
                                                        <tr>
                                                            <th className="w-[44px] px-2 py-2" />
                                                            {itemCols["#"] ? <th className={cls("w-[56px] px-2 py-2 text-left", H.th)}>#</th> : null}
                                                            {itemCols["Description"] ? <th className={cls("px-2 py-2 text-left w-[42%] min-w-[360px]", H.th)}>Description</th> : null}
                                                            {itemCols["Service Ref"] ? <th className={cls("px-2 py-2 text-left w-[190px]", H.th)}>Service Ref</th> : null}
                                                            {itemCols["Qty"] ? <th className={cls("w-[70px] px-2 py-2 text-right", H.th)}>Qty</th> : null}
                                                            {itemCols["Price"] ? <th className={cls("w-[120px] px-2 py-2 text-right", H.th)}>Price</th> : null}
                                                            {itemCols["GST %"] ? <th className={cls("w-[80px] px-2 py-2 text-right", H.th)}>GST %</th> : null}
                                                            {itemCols["Discount"] ? <th className={cls("w-[150px] px-2 py-2 text-right", H.th)}>Discount</th> : null}
                                                            {itemCols["Total"] ? <th className={cls("w-[140px] px-2 py-2 text-right", H.th)}>Total</th> : null}
                                                            {itemCols["Actions"] ? <th className={cls("w-[220px] px-2 py-2 text-right", H.th)}>Actions</th> : null}
                                                        </tr>
                                                    </thead>

                                                    <tbody>
                                                        {filteredItems.map((it, idx) => {
                                                            const SvcIcon = serviceIcon(it.service_type);
                                                            const open = !!expandedItems[it.id];
                                                            const zebra = idx % 2 ? H.zebraB : H.zebraA;

                                                            return (
                                                                <Fragment key={it.id}>
                                                                    <tr className={cls(zebra, H.rowHover, "border-b", H.borderSoft, it.is_voided && "opacity-70")}>
                                                                        <td className="px-2 py-2 align-middle">
                                                                            <IconButton
                                                                                title="Expand row"
                                                                                onClick={() => setExpandedItems((p) => ({ ...p, [it.id]: !p[it.id] }))}
                                                                                icon={open ? ChevronUp : ChevronDown}
                                                                            />
                                                                        </td>

                                                                        {itemCols["#"] ? (
                                                                            <td className={cls("px-2 py-2 align-middle", H.muted)}>{idx + 1}</td>
                                                                        ) : null}

                                                                        {itemCols["Description"] ? (
                                                                            <td className="px-2 py-2 align-middle">
                                                                                <div className="flex items-start gap-2 min-w-0">
                                                                                    <div className={cls("mt-0.5 rounded-xl border bg-white p-1.5", H.borderSoft)}>
                                                                                        <SvcIcon className="h-4 w-4 text-[#2B2118]" />
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <div className="font-semibold text-[#2B2118] truncate">
                                                                                            {it.description}
                                                                                        </div>
                                                                                        <div className={cls("text-[11px] flex flex-wrap items-center gap-2", H.muted)}>
                                                                                            <span className="inline-flex items-center gap-1">
                                                                                                <Hash className="h-3 w-3" />
                                                                                                {it.service_type || "—"} / {it.service_ref_id ?? "—"}
                                                                                            </span>
                                                                                            {it.is_voided ? (
                                                                                                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold bg-[#FBE9E7] text-[#7A1F1B] border-[#E7B3AE]">
                                                                                                    <XCircle className="h-3 w-3" />
                                                                                                    VOID
                                                                                                </span>
                                                                                            ) : null}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                        ) : null}

                                                                        {itemCols["Service Ref"] ? (
                                                                            <td className={cls("px-2 py-2 align-middle", H.td)}>
                                                                                <div className="text-[11px] truncate">Type: {it.service_type || "—"}</div>
                                                                                <div className="text-[11px] truncate">Ref: {it.service_ref_id ?? "—"}</div>
                                                                            </td>
                                                                        ) : null}

                                                                        {itemCols["Qty"] ? (
                                                                            <td className={cls("px-2 py-2 text-right align-middle", H.td)}>
                                                                                {it.quantity}
                                                                            </td>
                                                                        ) : null}

                                                                        {itemCols["Price"] ? (
                                                                            <td className={cls("px-2 py-2 text-right align-middle tabular-nums", H.td)}>
                                                                                {formatMoney(it.unit_price)}
                                                                            </td>
                                                                        ) : null}

                                                                        {itemCols["GST %"] ? (
                                                                            <td className={cls("px-2 py-2 text-right align-middle tabular-nums", H.td)}>
                                                                                {Number(it.tax_rate || 0)}%
                                                                            </td>
                                                                        ) : null}

                                                                        {itemCols["Discount"] ? (
                                                                            <td className={cls("px-2 py-2 text-right align-middle tabular-nums", H.td)}>
                                                                                {it.discount_percent ? `${Number(it.discount_percent)}%` : "—"}
                                                                                {it.discount_amount ? ` / ₹ ${formatMoney(it.discount_amount)}` : ""}
                                                                            </td>
                                                                        ) : null}

                                                                        {itemCols["Total"] ? (
                                                                            <td className={cls("px-2 py-2 text-right align-middle font-bold tabular-nums", H.text)}>
                                                                                ₹ {formatMoney(it.line_total)}
                                                                            </td>
                                                                        ) : null}

                                                                        {itemCols["Actions"] ? (
                                                                            <td className="px-2 py-2 text-right align-middle">
                                                                                {!isFinalized ? (
                                                                                    <div className="inline-flex justify-end gap-2">
                                                                                        <Button variant="secondary" icon={Pencil} onClick={() => startEditItem(it)}>
                                                                                            Edit
                                                                                        </Button>
                                                                                        <Button variant="softDanger" icon={XCircle} onClick={() => handleVoidItem(it)}>
                                                                                            Void
                                                                                        </Button>
                                                                                    </div>
                                                                                ) : null}
                                                                            </td>
                                                                        ) : null}
                                                                    </tr>

                                                                    {open ? (
                                                                        <tr className={cls(H.soft2, "border-b", H.borderSoft)}>
                                                                            <td colSpan={itemColSpan} className="px-3 py-3">
                                                                                <div className="grid grid-cols-4 gap-2 text-[11px]">
                                                                                    <div className={cls("rounded-xl border p-2", H.border, H.card)}>
                                                                                        <div className={H.muted}>Qty</div>
                                                                                        <div className="font-semibold text-[#2B2118]">{it.quantity}</div>
                                                                                    </div>
                                                                                    <div className={cls("rounded-xl border p-2", H.border, H.card)}>
                                                                                        <div className={H.muted}>Unit Price</div>
                                                                                        <div className="font-semibold text-[#2B2118]">₹ {formatMoney(it.unit_price)}</div>
                                                                                    </div>
                                                                                    <div className={cls("rounded-xl border p-2", H.border, H.card)}>
                                                                                        <div className={H.muted}>GST</div>
                                                                                        <div className="font-semibold text-[#2B2118]">{Number(it.tax_rate || 0)}%</div>
                                                                                    </div>
                                                                                    <div className={cls("rounded-xl border p-2", H.border, H.card)}>
                                                                                        <div className={H.muted}>Discount</div>
                                                                                        <div className="font-semibold text-[#2B2118]">
                                                                                            {it.discount_percent ? `${Number(it.discount_percent)}%` : "—"}
                                                                                            {it.discount_amount ? ` / ₹ ${formatMoney(it.discount_amount)}` : ""}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                <div className={cls("mt-2 text-[11px]", H.muted)}>
                                                                                    Service: <span className="font-semibold text-[#2B2118]">{it.service_type || "—"}</span>{" "}
                                                                                    • Ref: <span className="font-semibold text-[#2B2118]">{it.service_ref_id ?? "—"}</span>{" "}
                                                                                    • Line Total: <span className="font-bold text-[#2B2118]">₹ {formatMoney(it.line_total)}</span>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ) : null}
                                                                </Fragment>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Mobile cards */}
                                            <div className="md:hidden space-y-3">
                                                {filteredItems.map((it) => {
                                                    const SvcIcon = serviceIcon(it.service_type);
                                                    const open = !!expandedItems[it.id];
                                                    return (
                                                        <Panel key={it.id} className={cls("p-3", it.is_voided && "opacity-70")}>
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-start gap-2 min-w-0">
                                                                    <div className={cls("mt-0.5 rounded-xl border bg-white p-2", H.borderSoft)}>
                                                                        <SvcIcon className="h-4 w-4 text-[#2B2118]" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="text-[13px] font-semibold text-[#2B2118] truncate">{it.description}</div>
                                                                        <div className={cls("mt-1 text-[11px] flex flex-wrap gap-2", H.muted)}>
                                                                            <span className="inline-flex items-center gap-1">
                                                                                <Hash className="h-3.5 w-3.5" />
                                                                                {it.service_type} / {it.service_ref_id}
                                                                            </span>
                                                                            {it.is_voided ? (
                                                                                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold bg-[#FBE9E7] text-[#7A1F1B] border-[#E7B3AE]">
                                                                                    <XCircle className="h-3.5 w-3.5" />
                                                                                    VOID
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <IconButton
                                                                    title="Expand"
                                                                    onClick={() => setExpandedItems((p) => ({ ...p, [it.id]: !p[it.id] }))}
                                                                    icon={open ? ChevronUp : ChevronDown}
                                                                />
                                                            </div>

                                                            <div className="mt-3 flex items-center justify-between">
                                                                <div className={cls("text-[11px]", H.muted)}>Line Total</div>
                                                                <div className="text-[14px] font-bold text-[#2B2118]">₹ {formatMoney(it.line_total)}</div>
                                                            </div>

                                                            {open ? (
                                                                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                                                    <div className={cls("rounded-xl border p-2", H.border, H.soft2)}>
                                                                        <div className={H.muted}>Qty</div>
                                                                        <div className="font-semibold text-[#2B2118]">{it.quantity}</div>
                                                                    </div>
                                                                    <div className={cls("rounded-xl border p-2", H.border, H.soft2)}>
                                                                        <div className={H.muted}>Unit Price</div>
                                                                        <div className="font-semibold text-[#2B2118]">₹ {formatMoney(it.unit_price)}</div>
                                                                    </div>
                                                                    <div className={cls("rounded-xl border p-2", H.border, H.soft2)}>
                                                                        <div className={H.muted}>GST</div>
                                                                        <div className="font-semibold text-[#2B2118]">{Number(it.tax_rate || 0)}%</div>
                                                                    </div>
                                                                    <div className={cls("rounded-xl border p-2", H.border, H.soft2)}>
                                                                        <div className={H.muted}>Discount</div>
                                                                        <div className="font-semibold text-[#2B2118]">
                                                                            {it.discount_percent ? `${Number(it.discount_percent)}%` : "—"}
                                                                            {it.discount_amount ? ` / ₹ ${formatMoney(it.discount_amount)}` : ""}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : null}

                                                            {!isFinalized ? (
                                                                <div className="mt-3 flex gap-2 justify-end">
                                                                    <Button variant="secondary" icon={Pencil} onClick={() => startEditItem(it)}>
                                                                        Edit
                                                                    </Button>
                                                                    <Button variant="softDanger" icon={XCircle} onClick={() => handleVoidItem(it)}>
                                                                        Void
                                                                    </Button>
                                                                </div>
                                                            ) : null}
                                                        </Panel>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className={cls("p-4 text-xs flex items-start gap-2", H.muted)}>
                                    <Info className="h-4 w-4 mt-0.5" />
                                    Items section collapsed.
                                </div>
                            )}
                        </Panel>

                        {/* Payments */}
                        <Panel>
                            <SectionHeader
                                icon={CreditCard}
                                title="Payments & Refunds"
                                subtitle="Receipts and refunds recorded for this invoice"
                                right={
                                    <div className="flex flex-wrap items-center gap-2 justify-end">
                                        <CollapseToggle open={paymentsOpen} onClick={() => setPaymentsOpen((v) => !v)} />
                                       
                                        {!isFinalized ? (
                                            <>
                                                <Button variant="softDanger" icon={Undo2} onClick={() => openPayment("refund")}>
                                                    Add Refund
                                                </Button>
                                                <Button variant="primary" icon={PlusCircle} onClick={() => openPayment("payment")}>
                                                    Add Payment
                                                </Button>
                                            </>
                                        ) : (
                                            <span className={cls("text-[12px] font-semibold", H.muted)}>Locked</span>
                                        )}
                                    </div>
                                }
                            />

                            {paymentsOpen ? (
                                <div className="p-4">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <Chip icon={Banknote} label="Payments" value={`₹ ${formatMoney(paidTotal)}`} tone="emerald" />
                                        <Chip icon={Undo2} label="Refunds" value={`₹ ${formatMoney(refundsAbsTotal)}`} tone="rose" />
                                        <Chip icon={Wallet} label="Deposit Used" value={`₹ ${formatMoney(depositUsed)}`} tone="indigo" />
                                    </div>

                                    <div className={cls("rounded-xl border px-3 py-2 flex items-center gap-2 mb-3", H.border, H.card)}>
                                        <Search className="h-4 w-4 text-[#6B5E55]" />
                                        <input
                                            value={payQuery}
                                            onChange={(e) => setPayQuery(e.target.value)}
                                            className="bg-transparent outline-none text-xs w-full text-[#2B2118] placeholder:text-[#8A7B70]"
                                            placeholder="Search payments by mode / reference / notes…"
                                        />
                                    </div>

                                    {/* ✅ Desktop table (alignment fixed) */}
                                    <div className="hidden md:block overflow-x-auto">
                                        {filteredPayments.length === 0 ? (
                                            <div className={cls("rounded-2xl border p-4 text-xs flex items-start gap-2", H.border, H.soft2, H.muted)}>
                                                <Info className="h-4 w-4 mt-0.5" />
                                                No entries (or nothing matches search).
                                            </div>
                                        ) : (
                                            <table className={cls("w-full min-w-[860px] text-xs border border-collapse table-fixed", H.border)}>
                                                <thead className={cls(H.soft, "border-b", H.border)}>
                                                    <tr>
                                                        <th className="w-[44px] px-2 py-2" />
                                                        {payCols["Mode"] ? <th className={cls("px-2 py-2 text-left w-[190px]", H.th)}>Mode</th> : null}
                                                        {payCols["Reference"] ? <th className={cls("px-2 py-2 text-left w-[190px]", H.th)}>Reference</th> : null}
                                                        {payCols["Notes"] ? <th className={cls("px-2 py-2 text-left", H.th)}>Notes</th> : null}
                                                        {payCols["Time"] ? <th className={cls("px-2 py-2 text-left w-[190px]", H.th)}>Time</th> : null}
                                                        {payCols["Amount"] ? <th className={cls("w-[140px] px-2 py-2 text-right", H.th)}>Amount</th> : null}
                                                        {payCols["Actions"] ? <th className={cls("w-[170px] px-2 py-2 text-right", H.th)}>Actions</th> : null}
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {filteredPayments.map((p, i) => {
                                                        const Icon = modeIcon(p.mode);
                                                        const isRefund = Number(p.amount || 0) < 0;
                                                        const open = !!expandedPays[p.id];
                                                        const zebra = i % 2 ? H.zebraB : H.zebraA;

                                                        return (
                                                            <Fragment key={p.id}>
                                                                <tr className={cls(zebra, H.rowHover, "border-b", H.borderSoft)}>
                                                                    <td className="px-2 py-2 align-middle">
                                                                        <IconButton
                                                                            title="Expand row"
                                                                            onClick={() => setExpandedPays((x) => ({ ...x, [p.id]: !x[p.id] }))}
                                                                            icon={open ? ChevronUp : ChevronDown}
                                                                        />
                                                                    </td>

                                                                    {payCols["Mode"] ? (
                                                                        <td className={cls("px-2 py-2 font-semibold align-middle", H.text)}>
                                                                            <span className="inline-flex items-center gap-2 min-w-0">
                                                                                <span className={cls("rounded-xl border bg-white p-1.5", H.borderSoft)}>
                                                                                    <Icon className="h-4 w-4 text-[#2B2118]" />
                                                                                </span>
                                                                                <span className="truncate">{p.mode || "—"}</span>
                                                                            </span>
                                                                        </td>
                                                                    ) : null}

                                                                    {payCols["Reference"] ? (
                                                                        <td className={cls("px-2 py-2 align-middle truncate", H.td)}>{p.reference_no || "—"}</td>
                                                                    ) : null}

                                                                    {payCols["Notes"] ? (
                                                                        <td className={cls("px-2 py-2 align-middle truncate", H.td)}>{p.notes || "—"}</td>
                                                                    ) : null}

                                                                    {payCols["Time"] ? (
                                                                        <td className={cls("px-2 py-2 align-middle", H.muted)}>
                                                                            <span className="inline-flex items-center gap-1">
                                                                                <CalendarDays className="h-3.5 w-3.5" />
                                                                                {fmtDt(p.paid_at)}
                                                                            </span>
                                                                        </td>
                                                                    ) : null}

                                                                    {payCols["Amount"] ? (
                                                                        <td className={cls("px-2 py-2 text-right align-middle font-bold tabular-nums", isRefund ? "text-[#7A1F1B]" : "text-[#1E5A3C]")}>
                                                                            ₹ {formatMoney(p.amount)}
                                                                        </td>
                                                                    ) : null}

                                                                    {payCols["Actions"] ? (
                                                                        <td className="px-2 py-2 text-right align-middle">
                                                                            {!isFinalized ? (
                                                                                <Button variant="softDanger" icon={Trash2} onClick={() => handleDeletePayment(p)}>
                                                                                    Delete
                                                                                </Button>
                                                                            ) : null}
                                                                        </td>
                                                                    ) : null}
                                                                </tr>

                                                                {open ? (
                                                                    <tr className={cls(H.soft2, "border-b", H.borderSoft)}>
                                                                        <td colSpan={payColSpan} className="px-3 py-3">
                                                                            <div className="grid grid-cols-3 gap-2 text-[11px]">
                                                                                <div className={cls("rounded-xl border p-2", H.border, H.card)}>
                                                                                    <div className={H.muted}>Reference</div>
                                                                                    <div className="font-semibold text-[#2B2118] truncate">{p.reference_no || "—"}</div>
                                                                                </div>
                                                                                <div className={cls("rounded-xl border p-2", H.border, H.card)}>
                                                                                    <div className={H.muted}>Notes</div>
                                                                                    <div className="font-semibold text-[#2B2118] truncate">{p.notes || "—"}</div>
                                                                                </div>
                                                                                <div className={cls("rounded-xl border p-2", H.border, H.card)}>
                                                                                    <div className={H.muted}>Time</div>
                                                                                    <div className="font-semibold text-[#2B2118]">{fmtDt(p.paid_at)}</div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ) : null}
                                                            </Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>

                                    {/* Mobile cards */}
                                    <div className="md:hidden space-y-3">
                                        {filteredPayments.length === 0 ? (
                                            <div className={cls("rounded-2xl border p-4 text-xs flex items-start gap-2", H.border, H.soft2, H.muted)}>
                                                <Info className="h-4 w-4 mt-0.5" />
                                                No payments recorded (or nothing matches search).
                                            </div>
                                        ) : (
                                            filteredPayments.map((p) => {
                                                const Icon = modeIcon(p.mode);
                                                const isRefund = Number(p.amount || 0) < 0;
                                                const open = !!expandedPays[p.id];
                                                return (
                                                    <Panel key={p.id} className="p-3">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-start gap-2 min-w-0">
                                                                <div className={cls("rounded-xl border bg-white p-2", H.borderSoft)}>
                                                                    <Icon className="h-4 w-4 text-[#2B2118]" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-[13px] font-semibold text-[#2B2118] truncate">{p.mode || "—"}</div>
                                                                    <div className={cls("mt-1 text-[11px]", H.muted)}>{fmtDt(p.paid_at)}</div>
                                                                    <div className="mt-1 text-[11px] text-[#2B2118] truncate">Ref: {p.reference_no || "—"}</div>
                                                                </div>
                                                            </div>

                                                            <IconButton
                                                                title="Expand"
                                                                onClick={() => setExpandedPays((x) => ({ ...x, [p.id]: !x[p.id] }))}
                                                                icon={open ? ChevronUp : ChevronDown}
                                                            />
                                                        </div>

                                                        <div className="mt-2 flex items-center justify-between">
                                                            <div className={cls("text-[11px]", H.muted)}>Amount</div>
                                                            <div className={cls("text-[14px] font-bold tabular-nums", isRefund ? "text-[#7A1F1B]" : "text-[#1E5A3C]")}>
                                                                ₹ {formatMoney(p.amount)}
                                                            </div>
                                                        </div>

                                                        {open ? <div className="mt-2 text-[11px] text-[#2B2118]">Notes: {p.notes || "—"}</div> : null}

                                                        {!isFinalized ? (
                                                            <div className="mt-3 flex justify-end">
                                                                <Button variant="softDanger" icon={Trash2} onClick={() => handleDeletePayment(p)}>
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </Panel>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className={cls("p-4 text-xs flex items-start gap-2", H.muted)}>
                                    <Info className="h-4 w-4 mt-0.5" />
                                    Payments section collapsed.
                                </div>
                            )}
                        </Panel>
                    </div>
                </div>

                {/* Sticky bottom action bar */}
                <div className="sticky bottom-0 z-30">
                    <Panel className="mt-3">
                        <div className={cls("px-3 md:px-5 py-3 border-b", H.borderSoft, H.soft)} />
                        <div className="px-3 md:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                                <Chip icon={CheckCircle2} label="Net" value={`₹ ${formatMoney(invoice.net_total)}`} tone="indigo" />
                                <Chip icon={Banknote} label="Paid" value={`₹ ${formatMoney(invoice.amount_paid)}`} tone="emerald" />
                                <Chip icon={Wallet} label="Deposit Used" value={`₹ ${formatMoney(invoice.advance_adjusted)}`} tone="amber" />
                                <Chip icon={MinusCircle} label="Balance" value={`₹ ${formatMoney(invoice.balance_due)}`} tone="rose" />
                            </div>

                            <div className="flex gap-2 justify-end">
                                {!isFinalized ? (
                                    <>
                                        <Button
                                            variant="secondary"
                                            icon={busyAction === "cancel" ? Loader2 : XCircle}
                                            onClick={handleCancel}
                                            disabled={busyAction === "cancel"}
                                        >
                                            {busyAction === "cancel" ? "Cancelling…" : "Cancel"}
                                        </Button>

                                        <Button
                                            variant="primary"
                                            icon={busyAction === "finalize" ? Loader2 : BadgeCheck}
                                            onClick={handleFinalize}
                                            disabled={busyAction === "finalize"}
                                        >
                                            {busyAction === "finalize" ? "Finalizing…" : "Finalize"}
                                        </Button>
                                    </>
                                ) : (
                                    <div className={cls("text-[12px] font-semibold", H.muted)}>
                                        Invoice locked: {invoice.status}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>

            {/* Floating Add Item (mobile) */}
            {!isFinalized ? (
                <button
                    type="button"
                    onClick={() => setShowManualForm(true)}
                    className={cls(
                        "md:hidden fixed right-4 bottom-24 z-40 h-12 w-12 rounded-2xl shadow-2xl flex items-center justify-center",
                        "bg-[#2A1F18] text-white hover:bg-[#1F1712]"
                    )}
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
                        <Button variant="secondary" onClick={() => setShowManualForm(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" form="manual-item-form" type="submit">
                            Add Item
                        </Button>
                    </div>
                }
            >
                <form id="manual-item-form" className="space-y-3" onSubmit={handleAddManualItem}>
                    <Field label="Description">
                        <Input type="text" name="description" value={manualForm.description} onChange={onManualChange} required />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Qty">
                            <Input type="number" name="quantity" value={manualForm.quantity} min={1} onChange={onManualChange} />
                        </Field>
                        <Field label="Unit Price">
                            <Input type="number" name="unit_price" value={manualForm.unit_price} step="0.01" onChange={onManualChange} required />
                        </Field>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Tax %">
                            <Input type="number" name="tax_rate" value={manualForm.tax_rate} step="0.1" onChange={onManualChange} />
                        </Field>
                        <Field label="Disc %">
                            <Input type="number" name="discount_percent" value={manualForm.discount_percent} step="0.1" onChange={onManualChange} />
                        </Field>
                        <Field label="Disc Amt">
                            <Input type="number" name="discount_amount" value={manualForm.discount_amount} step="0.01" onChange={onManualChange} />
                        </Field>
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
                        <Button variant="secondary" onClick={() => setEditingItemId(null)}>
                            Cancel
                        </Button>
                        <Button variant="primary" form="edit-item-form" type="submit">
                            Save
                        </Button>
                    </div>
                }
            >
                <form id="edit-item-form" className="space-y-3" onSubmit={handleUpdateItem}>
                    <Field label="Description">
                        <Input type="text" name="description" value={itemForm.description} onChange={onItemChange} required />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Qty">
                            <Input type="number" name="quantity" value={itemForm.quantity} min={1} onChange={onItemChange} />
                        </Field>
                        <Field label="Unit Price">
                            <Input type="number" name="unit_price" value={itemForm.unit_price} step="0.01" onChange={onItemChange} required />
                        </Field>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Tax %">
                            <Input type="number" name="tax_rate" value={itemForm.tax_rate} step="0.1" onChange={onItemChange} />
                        </Field>
                        <Field label="Disc %">
                            <Input type="number" name="discount_percent" value={itemForm.discount_percent} step="0.1" onChange={onItemChange} />
                        </Field>
                        <Field label="Disc Amt">
                            <Input type="number" name="discount_amount" value={itemForm.discount_amount} step="0.01" onChange={onItemChange} />
                        </Field>
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
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowPaymentForm(false);
                                setPaymentKind("payment");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button variant={paymentKind === "refund" ? "danger" : "primary"} form="payment-form" type="submit">
                            {paymentKind === "refund" ? "Save Refund" : "Save Payment"}
                        </Button>
                    </div>
                }
            >
                <form id="payment-form" className="space-y-3" onSubmit={handleAddPayment}>
                    <div className="grid grid-cols-2 gap-3">
                        <Field
                            label="Amount"
                            hint={paymentKind === "refund" ? "Refund will be saved as negative amount." : "Payment is saved as positive amount."}
                        >
                            <Input type="number" name="amount" value={paymentForm.amount} onChange={onPaymentChange} step="0.01" required />
                        </Field>

                        <Field label="Mode">
                            <Select name="mode" value={paymentForm.mode} onChange={onPaymentChange}>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="upi">UPI</option>
                                <option value="credit">Credit</option>
                                <option value="cheque">Cheque</option>
                                <option value="neft/rtgs">NEFT/RTGS</option>
                                <option value="wallet">Wallet</option>
                                <option value="refund">Refund</option>
                                <option value="other">Other</option>
                            </Select>
                        </Field>
                    </div>

                    <Field label="Reference No">
                        <Input type="text" name="reference_no" value={paymentForm.reference_no} onChange={onPaymentChange} />
                    </Field>

                    <Field label="Notes">
                        <Input type="text" name="notes" value={paymentForm.notes} onChange={onPaymentChange} />
                    </Field>
                </form>
            </Modal>

            <Modal
                open={showWalletApply && !isFinalized}
                title="Apply Advance / Deposit"
                icon={Wallet}
                onClose={() => setShowWalletApply(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setShowWalletApply(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" form="wallet-apply-form" type="submit" disabled={walletApplying}>
                            {walletApplying ? "Applying…" : "Apply"}
                        </Button>
                    </div>
                }
            >
                <div className={cls("rounded-2xl border p-3 text-xs", H.border, H.soft2)}>
                    <div className="flex justify-between">
                        <span className={H.muted}>Available Deposit</span>
                        <span className="font-bold text-[#1E5A3C]">₹ {formatMoney(walletAvailable)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className={H.muted}>Invoice Balance Due</span>
                        <span className="font-bold text-[#2B2118]">₹ {formatMoney(invoice.balance_due)}</span>
                    </div>
                </div>

                <form id="wallet-apply-form" onSubmit={handleWalletApplySubmit} className="space-y-3 mt-3">
                    <Field label="Apply Amount" hint="Cannot exceed available deposit or balance due.">
                        <Input
                            type="number"
                            value={walletApplyAmt}
                            onChange={(e) => setWalletApplyAmt(e.target.value)}
                            step="0.01"
                            min="0"
                            placeholder="Enter amount to apply"
                            required
                        />
                    </Field>
                </form>
            </Modal>

            {/* Unbilled Drawer */}
            <Drawer
                open={showUnbilled}
                title="Unbilled Services"
                subtitle="Select and bulk add into this invoice"
                onClose={() => setShowUnbilled(false)}
                width="sm:w-[760px]"
                footer={
                    <div className="flex items-center justify-between">
                        <div className="text-[12px] font-semibold text-[#2B2118]">
                            {Object.keys(unbilledSelected).filter((k) => unbilledSelected[k]).length} selected
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setShowUnbilled(false)}>
                                Close
                            </Button>
                            <Button variant="primary" onClick={addSelectedUnbilled} disabled={busyAction === "unbilled"}>
                                {busyAction === "unbilled" ? "Adding…" : "Add Selected"}
                            </Button>
                        </div>
                    </div>
                }
            >
                {unbilledLoading ? (
                    <div className={cls("p-4 text-xs flex items-center gap-2", H.muted)}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                    </div>
                ) : (unbilled || []).length === 0 ? (
                    <div className={cls("p-4 text-xs", H.muted)}>No unbilled services.</div>
                ) : (
                    <div className={cls("divide-y", H.borderSoft)}>
                        {(unbilled || []).map((u) => {
                            const key = String(u.uid || `${u.service_type || "svc"}-${u.ref_id || u.id || "x"}`);
                            return (
                                <div key={key} className={cls("p-4 flex gap-3 transition", H.rowHover)}>
                                    <input
                                        type="checkbox"
                                        checked={!!unbilledSelected[key]}
                                        onChange={() => toggleUnbilled(key)}
                                        className="mt-1"
                                    />
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-semibold text-[#2B2118] truncate">
                                            {u.title || u.description || `${u.service_type} #${u.ref_id}`}
                                        </div>
                                        <div className={cls("text-[11px]", H.muted)}>
                                            {u.service_type} • Ref #{u.ref_id} • ₹ {formatMoney(u.amount || 0)}
                                        </div>
                                        {u.meta ? <div className={cls("text-[11px]", H.muted)}>{String(u.meta)}</div> : null}
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
