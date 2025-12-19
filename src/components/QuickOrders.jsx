// FILE: src/components/QuickOrders.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
    FlaskConical,
    Radio,
    Pill,
    ScissorsLineDashed,
    Activity,
    Clock,
    User,
    BedDouble,
    Hash,
    AlertTriangle,
    Search,
    Loader2,
    Download,
    Eye,
    Printer,
    ClipboardCopy,
    Sparkles,
    Trash2,
    FileText,
    RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";

// ---- Quick Orders helpers ----
import {
    createPharmacyPrescriptionFromContext,
    createOtScheduleFromContext,
    listLabOrdersForContext,
    listRadiologyOrdersForContext,
    listPharmacyPrescriptionsForContext,
    listOtSchedulesForContext,

    // ✅ Rx full details + PDF
    getRxDetails,
    downloadRxPdf,

    // ✅ Visit summary PDF (keep)
    fetchVisitSummaryPdf,
} from "../api/quickOrders";

// ---- Core APIs for Lab & Radiology ----
import { listLabTests, createLisOrder, fetchLisReportPdf } from "../api/lab";
import { listRisTests, createRisOrder } from "../api/ris";

// Pharmacy inventory search
import { searchPharmacyItems } from "../api/pharmacy";

// OT procedures master
import { listOtProcedures } from "../api/ot";

// pickers
import DoctorPicker from "../opd/components/DoctorPicker";
import WardRoomBedPicker from "../components/pickers/BedPicker";

const fadeIn = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18 },
};

const LS_RX_TEMPLATES = "nutryah_rx_templates_v1";

function cx(...a) {
    return a.filter(Boolean).join(" ");
}

/* =========================================================
   Premium UI Tokens (Apple-ish)
========================================================= */
const TONE = {
    lab: {
        solid:
            "bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 text-white shadow-[0_12px_30px_rgba(2,132,199,0.22)] hover:brightness-[1.06] active:brightness-[0.98]",
        soft:
            "bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100/70",
        ring: "focus-visible:ring-sky-500/35",
        chip: "bg-sky-50 text-sky-700",
        icon: "text-sky-600",
    },
    ris: {
        solid:
            "bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-700 text-white shadow-[0_12px_30px_rgba(79,70,229,0.22)] hover:brightness-[1.06] active:brightness-[0.98]",
        soft:
            "bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100/70",
        ring: "focus-visible:ring-indigo-500/35",
        chip: "bg-indigo-50 text-indigo-700",
        icon: "text-indigo-600",
    },
    rx: {
        solid:
            "bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)] hover:brightness-[1.06] active:brightness-[0.98]",
        soft:
            "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/70",
        ring: "focus-visible:ring-emerald-500/35",
        chip: "bg-emerald-50 text-emerald-700",
        icon: "text-emerald-600",
    },
    ot: {
        solid:
            "bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 text-white shadow-[0_12px_30px_rgba(245,158,11,0.22)] hover:brightness-[1.06] active:brightness-[0.98]",
        soft:
            "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100/70",
        ring: "focus-visible:ring-amber-500/35",
        chip: "bg-amber-50 text-amber-800",
        icon: "text-amber-600",
    },
    slate: {
        solid:
            "bg-gradient-to-b from-slate-800 via-slate-900 to-black text-white shadow-[0_14px_34px_rgba(2,6,23,0.24)] hover:brightness-[1.06] active:brightness-[0.98]",
        soft:
            "bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100/70",
        ring: "focus-visible:ring-slate-500/30",
        chip: "bg-slate-100 text-slate-700",
        icon: "text-slate-600",
    },
};

function StatusChip({ children, tone = "slate" }) {
    const t = TONE[tone] || TONE.slate;
    return (
        <span
            className={cx(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                t.chip
            )}
        >
            {children}
        </span>
    );
}

function IconPill({ icon: Icon, tone = "slate", title, subtitle }) {
    const t = TONE[tone] || TONE.slate;
    return (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 backdrop-blur">
            <div
                className={cx(
                    "h-9 w-9 rounded-2xl flex items-center justify-center shadow-sm border",
                    t.soft
                )}
            >
                <Icon className={cx("h-4 w-4", t.icon)} />
            </div>
            <div className="min-w-0">
                <div className="text-[11px] text-slate-500">{title}</div>
                <div className="text-[12px] font-semibold text-slate-900 truncate">
                    {subtitle}
                </div>
            </div>
        </div>
    );
}

function PremiumButton({
    tone = "slate",
    variant = "solid",
    className = "",
    ...props
}) {
    const t = TONE[tone] || TONE.slate;
    const base =
        "rounded-2xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60 disabled:pointer-events-none";
    const v =
        variant === "solid"
            ? t.solid
            : variant === "soft"
                ? t.soft
                : "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50";
    return (
        <Button
            {...props}
            className={cx(base, v, t.ring, className)}
            variant={variant === "outline" ? "outline" : "default"}
        />
    );
}

// -----------------------------
// Small UI helpers
// -----------------------------
function safePatientName(p) {
    if (!p) return "Unknown patient";
    return (
        p.full_name ||
        p.name ||
        `${p.prefix || ""} ${p.first_name || ""} ${p.last_name || ""}`
            .replace(/\s+/g, " ")
            .trim()
    );
}

function safeGenderAge(p) {
    if (!p) return "—";
    const gender = p.gender || p.sex || "—";
    const age = p.age_display || p.age || "—";
    return `${gender} • ${age}`;
}

function fmtDT(v) {
    if (!v) return "—";
    try {
        return new Date(v).toLocaleString();
    } catch {
        return String(v);
    }
}

function fmtDate(v) {
    if (!v) return "—";
    try {
        const d = new Date(v);
        return d.toLocaleDateString();
    } catch {
        return String(v);
    }
}

function extractApiError(err, fallback = "Something went wrong") {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string") return detail;

    if (detail && !Array.isArray(detail) && typeof detail === "object") {
        if (detail.msg) return detail.msg;
        try {
            return JSON.stringify(detail);
        } catch {
            return fallback;
        }
    }

    if (Array.isArray(detail)) {
        const msgs = detail.map((d) => d?.msg).filter(Boolean);
        if (msgs.length) return msgs.join(", ");
        try {
            return JSON.stringify(detail);
        } catch {
            return fallback;
        }
    }

    if (err?.message) return err.message;
    return fallback;
}

// -----------------------------
// RX helpers
// -----------------------------
function freqToSlots(freq) {
    if (!freq) return { am: 0, af: 0, pm: 0, night: 0 };
    const f = String(freq).trim().toUpperCase();

    if (f.includes("-")) {
        const parts = f.split("-").map((x) => parseInt(x || "0", 10) || 0);
        if (parts.length === 3)
            return { am: parts[0], af: parts[1], pm: 0, night: parts[2] };
        if (parts.length >= 4)
            return { am: parts[0], af: parts[1], pm: parts[2], night: parts[3] };
    }

    const map = {
        OD: { am: 1, af: 0, pm: 0, night: 0 },
        QD: { am: 1, af: 0, pm: 0, night: 0 },
        BD: { am: 1, af: 0, pm: 0, night: 1 },
        BID: { am: 1, af: 0, pm: 0, night: 1 },
        TID: { am: 1, af: 1, pm: 0, night: 1 },
        TDS: { am: 1, af: 1, pm: 0, night: 1 },
        QID: { am: 1, af: 1, pm: 1, night: 1 },
        HS: { am: 0, af: 0, pm: 0, night: 1 },
        NIGHT: { am: 0, af: 0, pm: 0, night: 1 },
    };
    return map[f] || { am: 0, af: 0, pm: 0, night: 0 };
}

function slotsToFreq(slots) {
    const a = slots?.am ? 1 : 0;
    const b = slots?.af ? 1 : 0;
    const c = slots?.pm ? 1 : 0;
    const d = slots?.night ? 1 : 0;
    return `${a}-${b}-${c}-${d}`;
}

function openBlobInNewTab(blob) {
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function printBlob(blob) {
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
        toast.error("Popup blocked. Please allow popups to print.");
        return;
    }
    const timer = setInterval(() => {
        try {
            w.focus();
            w.print();
            clearInterval(timer);
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch { }
    }, 700);
    setTimeout(() => clearInterval(timer), 8000);
}

async function labPdfActions(orderId, mode) {
    if (!orderId) return toast.error("Invalid Lab Order ID");
    try {
        const res = await fetchLisReportPdf(orderId);
        const blob = new Blob([res.data], { type: "application/pdf" });
        if (mode === "view") openBlobInNewTab(blob);
        if (mode === "download") downloadBlob(blob, `lab_report_${orderId}.pdf`);
        if (mode === "print") printBlob(blob);
    } catch (e) {
        console.error(e);
        toast.error(extractApiError(e, "Lab PDF failed"));
    }
}

export default function QuickOrders({
    patient,
    contextType, // 'opd' | 'ipd'
    contextId, // visit_id / ipd_admission_id
    opNumber,
    ipNumber,
    bedLabel,
    currentUser,
    defaultLocationId,
}) {
    const [activeTab, setActiveTab] = useState("lab");

    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summary, setSummary] = useState({ lab: [], ris: [], rx: [], ot: [] });

    // ------------- LAB state -------------
    const [labQuery, setLabQuery] = useState("");
    const [labOptions, setLabOptions] = useState([]);
    const [labSearching, setLabSearching] = useState(false);
    const [showLabDropdown, setShowLabDropdown] = useState(false);
    const labDropRef = useRef(null);

    const [labSelectedTests, setLabSelectedTests] = useState([]); // [{id, code, name}]
    const [labPriority, setLabPriority] = useState("routine");
    const [labNote, setLabNote] = useState("");
    const [labSubmitting, setLabSubmitting] = useState(false);

    const labTestIds = useMemo(
        () => labSelectedTests.map((t) => t.id),
        [labSelectedTests]
    );

    // ------------- RIS state -------------
    const [risQuery, setRisQuery] = useState("");
    const [risOptions, setRisOptions] = useState([]);
    const [risSearching, setRisSearching] = useState(false);
    const [showRisDropdown, setShowRisDropdown] = useState(false);
    const risDropRef = useRef(null);

    const [risSelectedTests, setRisSelectedTests] = useState([]); // [{id, code, name, modality}]
    const [risPriority, setRisPriority] = useState("routine");
    const [risNote, setRisNote] = useState("");
    const [risSubmitting, setRisSubmitting] = useState(false);

    const risTestIds = useMemo(
        () => risSelectedTests.map((t) => t.id),
        [risSelectedTests]
    );

    // ------------- Pharmacy state -------------
    const [rxQuery, setRxQuery] = useState("");
    const [rxOptions, setRxOptions] = useState([]);
    const [rxSearching, setRxSearching] = useState(false);
    const [showRxDropdown, setShowRxDropdown] = useState(false);
    const rxDropRef = useRef(null);

    const [rxSelectedItem, setRxSelectedItem] = useState(null);
    const [rxLines, setRxLines] = useState([]);
    const [rxDose, setRxDose] = useState("");
    const [rxDuration, setRxDuration] = useState("5");
    const [rxQty, setRxQty] = useState("10");
    const [rxRoute, setRxRoute] = useState("oral");
    const [rxTiming, setRxTiming] = useState("BF");
    const [rxNote, setRxNote] = useState("");
    const [rxSubmitting, setRxSubmitting] = useState(false);

    const [rxSlots, setRxSlots] = useState({
        am: true,
        af: false,
        pm: false,
        night: true,
    });
    const [rxTemplates, setRxTemplates] = useState(() => {
        try {
            const raw = localStorage.getItem(LS_RX_TEMPLATES);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    });
    const [rxTemplateId, setRxTemplateId] = useState("");
    const [lastRx, setLastRx] = useState(null);

    // ------------- OT state -------------
    const [otDate, setOtDate] = useState("");
    const [otStart, setOtStart] = useState("");
    const [otEnd, setOtEnd] = useState("");

    const [otProcedureQuery, setOtProcedureQuery] = useState("");
    const [otProcedureOptions, setOtProcedureOptions] = useState([]);
    const [otProcedureSearching, setOtProcedureSearching] = useState(false);
    const [showOtDropdown, setShowOtDropdown] = useState(false);
    const otDropRef = useRef(null);
    const [otSelectedProcedure, setOtSelectedProcedure] = useState(null);

    const [otPriority, setOtPriority] = useState("Elective");
    const [otSide, setOtSide] = useState("");
    const [otNote, setOtNote] = useState("");

    const [otBedId, setOtBedId] = useState(null);
    const [otSurgeonId, setOtSurgeonId] = useState(currentUser?.id || null);
    const [otAnaesthetistId, setOtAnaesthetistId] = useState(null);
    const [otSubmitting, setOtSubmitting] = useState(false);

    // ------------- Details sheet -------------
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsType, setDetailsType] = useState(null); // 'lab' | 'ris' | 'rx' | 'ot'
    const [detailsItem, setDetailsItem] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsFull, setDetailsFull] = useState(null);

    const closeDetails = () => {
        setDetailsOpen(false);
        setDetailsType(null);
        setDetailsItem(null);
        setDetailsFull(null);
        setDetailsLoading(false);
    };

    // ------------------------------------------------------
    // Context helpers
    // ------------------------------------------------------
    const ctx = useMemo(() => {
        if (!contextType) return null;
        const v = String(contextType).toLowerCase();
        if (v === "op" || v === "opd") return "opd";
        if (v === "ip" || v === "ipd") return "ipd";
        return v;
    }, [contextType]);

    const contextLabel = ctx === "ipd" ? "IPD Admission" : "OPD Visit";
    const contextNumberLabel =
        ctx === "ipd"
            ? ipNumber
                ? `IP No: ${ipNumber}`
                : "IP Number not set"
            : opNumber
                ? `OP No: ${opNumber}`
                : "OP Number not set";

    const bedInfo = ctx === "ipd" && bedLabel ? `Bed: ${bedLabel}` : null;
    const orderingUserId = currentUser?.id || null;

    const canUseContext = !!(patient?.id && ctx && contextId);

    // ------------------------------------------------------
    // Close dropdown on outside click / ESC
    // ------------------------------------------------------
    useEffect(() => {
        const onDown = (e) => {
            const t = e.target;
            if (labDropRef.current && !labDropRef.current.contains(t))
                setShowLabDropdown(false);
            if (risDropRef.current && !risDropRef.current.contains(t))
                setShowRisDropdown(false);
            if (rxDropRef.current && !rxDropRef.current.contains(t))
                setShowRxDropdown(false);
            if (otDropRef.current && !otDropRef.current.contains(t))
                setShowOtDropdown(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") {
                setShowLabDropdown(false);
                setShowRisDropdown(false);
                setShowRxDropdown(false);
                setShowOtDropdown(false);
            }
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    // ------------------------------------------------------
    // Load recent orders summary
    // ------------------------------------------------------
    const loadSummary = useCallback(async () => {
        if (!patient?.id || !ctx || !contextId) return;
        setLoadingSummary(true);
        try {
            const [lab, ris, rx, ot] = await Promise.all([
                listLabOrdersForContext({
                    patientId: patient.id,
                    contextType: ctx,
                    contextId,
                    limit: 10,
                }),
                listRadiologyOrdersForContext({
                    patientId: patient.id,
                    contextType: ctx,
                    contextId,
                    limit: 10,
                }),
                listPharmacyPrescriptionsForContext({
                    patientId: patient.id,
                    contextType: ctx,
                    contextId,
                    limit: 10,
                }),
                ctx === "ipd"
                    ? listOtSchedulesForContext({
                        patientId: patient.id,
                        admissionId: contextId,
                        limit: 10,
                    })
                    : Promise.resolve([]),
            ]);
            setSummary({
                lab: lab || [],
                ris: ris || [],
                rx: rx || [],
                ot: ot || [],
            });
        } catch (err) {
            console.error("Failed to load quick orders summary", err);
            toast.error("Unable to load recent orders for this patient.");
        } finally {
            setLoadingSummary(false);
        }
    }, [patient?.id, ctx, contextId]);

    useEffect(() => {
        loadSummary();
    }, [loadSummary]);

    // ------------------------------------------------------
    // Visit Summary PDF actions (OPD)
    // ------------------------------------------------------
    const visitPdfActions = async (mode) => {
        if (ctx !== "opd" || !contextId) return toast.error("Visit context missing");
        try {
            const res = await fetchVisitSummaryPdf(Number(contextId));
            const blob = new Blob([res.data], { type: "application/pdf" });
            if (mode === "view") openBlobInNewTab(blob);
            if (mode === "download")
                downloadBlob(blob, `opd_visit_${contextId}_summary.pdf`);
            if (mode === "print") printBlob(blob);
        } catch (e) {
            console.error(e);
            toast.error(extractApiError(e, "Visit PDF failed"));
        }
    };

    // ------------------------------------------------------
    // LAB master search (debounced)
    // ------------------------------------------------------
    useEffect(() => {
        if (!labQuery || labQuery.trim().length < 2) {
            setLabOptions([]);
            return;
        }
        let cancelled = false;
        const t = setTimeout(async () => {
            try {
                setLabSearching(true);
                const { data } = await listLabTests({ q: labQuery.trim() });
                if (cancelled) return;
                const items = Array.isArray(data) ? data : data?.items || [];
                setLabOptions(items);
                setShowLabDropdown(true);
            } catch (err) {
                console.error(err);
                toast.error("Failed to fetch lab tests.");
            } finally {
                if (!cancelled) setLabSearching(false);
            }
        }, 180);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [labQuery]);

    function handleSelectLabTest(t) {
        if (!t?.id) return;
        setLabSelectedTests((prev) => {
            if (prev.some((x) => x.id === t.id)) return prev;
            return [
                ...prev,
                { id: t.id, code: t.code || t.short_code || "", name: t.name || t.test_name || "" },
            ];
        });
        setLabQuery("");
        setShowLabDropdown(false);
    }

    function handleRemoveLabTest(id) {
        setLabSelectedTests((prev) => prev.filter((t) => t.id !== id));
    }

    async function handleSubmitLab() {
        if (!labTestIds.length) return toast.error("Add at least one lab test.");
        if (!patient?.id) return toast.error("Patient missing for lab order.");
        if (!ctx || !contextId)
            return toast.error("Missing context (OPD/IPD) for lab order.");

        setLabSubmitting(true);
        try {
            await createLisOrder({
                patient_id: patient.id,
                context_type: ctx,
                context_id: contextId,
                priority: labPriority,
                test_ids: labTestIds,
                note: labNote || null,
            });
            toast.success("Lab order created");
            setLabSelectedTests([]);
            setLabNote("");
            setLabQuery("");
            loadSummary();
        } catch (err) {
            console.error(err);
            toast.error(extractApiError(err, "Failed to create lab order"));
        } finally {
            setLabSubmitting(false);
        }
    }

    // ------------------------------------------------------
    // RIS master search (debounced)
    // ------------------------------------------------------
    useEffect(() => {
        if (!risQuery || risQuery.trim().length < 2) {
            setRisOptions([]);
            return;
        }
        let cancelled = false;
        const t = setTimeout(async () => {
            try {
                setRisSearching(true);
                const { data } = await listRisTests({ q: risQuery.trim() });
                if (cancelled) return;
                const items = Array.isArray(data) ? data : data?.items || [];
                setRisOptions(items);
                setShowRisDropdown(true);
            } catch (err) {
                console.error(err);
                toast.error("Failed to fetch radiology tests.");
            } finally {
                if (!cancelled) setRisSearching(false);
            }
        }, 180);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [risQuery]);

    function handleSelectRisTest(t) {
        if (!t?.id) return;
        setRisSelectedTests((prev) => {
            if (prev.some((x) => x.id === t.id)) return prev;
            return [
                ...prev,
                {
                    id: t.id,
                    code: t.code || "",
                    name: t.name || t.test_name || "",
                    modality: t.modality || t.modality_code || "",
                },
            ];
        });
        setRisQuery("");
        setShowRisDropdown(false);
    }

    function handleRemoveRisTest(id) {
        setRisSelectedTests((prev) => prev.filter((t) => t.id !== id));
    }

    async function handleSubmitRis() {
        if (!risTestIds.length)
            return toast.error("Add at least one radiology test.");
        if (!patient?.id)
            return toast.error("Patient missing for radiology order.");
        if (!ctx || !contextId)
            return toast.error("Missing context (OPD/IPD) for radiology order.");

        setRisSubmitting(true);
        try {
            await Promise.all(
                risTestIds.map((id) =>
                    createRisOrder({
                        patient_id: patient.id,
                        test_id: Number(id),
                        context_type: ctx,
                        context_id: contextId,
                        ordering_user_id: orderingUserId,
                        priority: risPriority,
                        note: risNote || null,
                    })
                )
            );
            toast.success("Radiology order(s) created");
            setRisSelectedTests([]);
            setRisNote("");
            setRisQuery("");
            loadSummary();
        } catch (err) {
            console.error(err);
            toast.error(extractApiError(err, "Failed to create radiology order(s)"));
        } finally {
            setRisSubmitting(false);
        }
    }

    // ------------------------------------------------------
    // Pharmacy inventory search (debounced)
    // ------------------------------------------------------
    useEffect(() => {
        if (!rxQuery || rxQuery.trim().length < 2) {
            setRxOptions([]);
            return;
        }
        let cancelled = false;
        const t = setTimeout(async () => {
            try {
                setRxSearching(true);
                const res = await searchPharmacyItems({
                    q: rxQuery.trim(),
                    type: "drug",
                    limit: 20,
                });
                if (cancelled) return;
                const items = Array.isArray(res?.data) ? res.data : [];
                setRxOptions(items);
                setShowRxDropdown(true);
            } catch (err) {
                console.error(err);
                toast.error("Failed to search medicines from inventory.");
            } finally {
                if (!cancelled) setRxSearching(false);
            }
        }, 180);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [rxQuery]);

    function handleSelectRxItem(it) {
        setRxSelectedItem(it);
        setRxQuery(it.name || "");
        setShowRxDropdown(false);
    }

    function applyRxMacro(name) {
        if (name === "OD")
            setRxSlots({ am: true, af: false, pm: false, night: false });
        if (name === "BD")
            setRxSlots({ am: true, af: false, pm: false, night: true });
        if (name === "TID")
            setRxSlots({ am: true, af: true, pm: false, night: true });
        if (name === "QID")
            setRxSlots({ am: true, af: true, pm: true, night: true });
        if (name === "NIGHT")
            setRxSlots({ am: false, af: false, pm: false, night: true });
    }

    function handleAddRxLine() {
        if (!rxSelectedItem) return toast.error("Select a medicine from inventory.");
        const qty = parseFloat(rxQty || "0") || 0;
        const duration = parseInt(rxDuration || "0", 10) || null;
        if (!qty) return toast.error("Enter a valid quantity.");

        const frequency_code = slotsToFreq(rxSlots);

        setRxLines((prev) => [
            ...prev,
            {
                item_id: rxSelectedItem.id,
                item_name: rxSelectedItem.name,
                requested_qty: qty,
                dose_text: rxDose || null,
                frequency_code,
                duration_days: duration,
                route: rxRoute || null,
                timing: rxTiming || null,
                instructions: null,
            },
        ]);

        setRxSelectedItem(null);
        setRxQuery("");
        setRxQty("10");
        setRxDose("");
    }

    function handleRemoveRxLine(idx) {
        setRxLines((prev) => prev.filter((_, i) => i !== idx));
    }

    async function handleSubmitRx() {
        if (!rxLines.length) return toast.error("Add at least one medicine.");
        if (!patient?.id || !ctx || !contextId)
            return toast.error("Missing patient or context for prescription.");

        setRxSubmitting(true);
        try {
            const created = await createPharmacyPrescriptionFromContext({
                patientId: patient.id,
                contextType: ctx,
                contextId,
                doctorUserId: orderingUserId,
                locationId: defaultLocationId,
                notes: rxNote,
                lines: rxLines,
            });

            toast.success("Prescription created & sent to Pharmacy.");
            setRxLines([]);
            setRxNote("");
            setRxQuery("");
            setRxSelectedItem(null);
            setLastRx(created && typeof created === "object" ? created : null);
            loadSummary();
        } catch (err) {
            console.error(err);
            toast.error(extractApiError(err, "Failed to create prescription."));
        } finally {
            setRxSubmitting(false);
        }
    }

    const rxActions = async (rxId, mode) => {
        if (!rxId) return toast.error("Invalid prescription ID");
        try {
            const res = await downloadRxPdf(rxId);
            const blob = new Blob([res.data], { type: "application/pdf" });
            if (mode === "view") openBlobInNewTab(blob);
            if (mode === "download") downloadBlob(blob, `prescription_${rxId}.pdf`);
            if (mode === "print") printBlob(blob);
        } catch (e) {
            console.error(e);
            toast.error("Prescription PDF failed");
        }
    };

    // ------------------------------------------------------
    // OT procedures master search (debounced)
    // ------------------------------------------------------
    useEffect(() => {
        if (!otProcedureQuery || otProcedureQuery.trim().length < 2) {
            setOtProcedureOptions([]);
            return;
        }
        let cancelled = false;
        const t = setTimeout(async () => {
            try {
                setOtProcedureSearching(true);
                const res = await listOtProcedures({
                    search: otProcedureQuery.trim(),
                    isActive: true,
                    limit: 20,
                });
                if (cancelled) return;
                const items = Array.isArray(res?.data?.items)
                    ? res.data.items
                    : Array.isArray(res?.data)
                        ? res.data
                        : [];
                setOtProcedureOptions(items);
                setShowOtDropdown(true);
            } catch (err) {
                console.error(err);
                toast.error("Failed to fetch OT procedures.");
            } finally {
                if (!cancelled) setOtProcedureSearching(false);
            }
        }, 180);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [otProcedureQuery]);

    function handleSelectOtProcedure(p) {
        setOtSelectedProcedure(p);
        setOtProcedureQuery(p.name || p.procedure_name || "");
        setShowOtDropdown(false);
    }

    async function handleSubmitOt() {
        if (ctx !== "ipd")
            return toast.warning("OT booking via quick orders is only for IPD.");
        if (!otDate || !otStart)
            return toast.warning("Please select OT date and start time.");
        if (!patient?.id || !contextId)
            return toast.error("Missing patient or admission for OT schedule.");

        const surgeonId = otSurgeonId || currentUser?.id;
        if (!surgeonId) return toast.error("Please select a surgeon.");

        const procedureName = otSelectedProcedure
            ? otSelectedProcedure.name || otSelectedProcedure.procedure_name
            : otProcedureQuery?.trim();

        if (!procedureName) return toast.error("Please enter a procedure name.");

        setOtSubmitting(true);
        try {
            await createOtScheduleFromContext({
                patientId: patient.id,
                contextType: ctx,
                admissionId: contextId,
                bedId: otBedId,
                surgeonUserId: surgeonId,
                anaesthetistUserId: otAnaesthetistId,
                date: otDate,
                plannedStartTime: otStart,
                plannedEndTime: otEnd || null,
                priority: otPriority,
                side: otSide || null,
                procedureName,
                primaryProcedureId: otSelectedProcedure?.id || null,
                additionalProcedureIds: [],
                notes: otNote,
            });

            toast.success("OT schedule created.");
            setOtDate("");
            setOtStart("");
            setOtEnd("");
            setOtBedId(null);
            setOtProcedureQuery("");
            setOtSelectedProcedure(null);
            setOtSide("");
            setOtPriority("Elective");
            setOtAnaesthetistId(null);
            setOtNote("");
            loadSummary();
        } catch (err) {
            console.error(err);
            toast.error(extractApiError(err, "Failed to create OT schedule."));
        } finally {
            setOtSubmitting(false);
        }
    }

    // ------------------------------------------------------
    // Templates
    // ------------------------------------------------------
    const applyTemplate = (tpl) => {
        if (!tpl) return;
        setRxNote(tpl.note || "");
        if (tpl.defaults?.route) setRxRoute(tpl.defaults.route);
        if (tpl.defaults?.timing) setRxTiming(tpl.defaults.timing);
        if (tpl.defaults?.days) setRxDuration(String(tpl.defaults.days));
        if (tpl.defaults?.qty) setRxQty(String(tpl.defaults.qty));
        if (tpl.defaults?.slots) setRxSlots(tpl.defaults.slots);
        toast.success(`Template applied: ${tpl.name}`);
    };

    const saveCurrentAsTemplate = () => {
        const name = window.prompt("Template name? (e.g. OPD Standard)");
        if (!name) return;

        const tpl = {
            id: `tpl_${Date.now()}`,
            name: name.trim(),
            note: rxNote || "",
            defaults: {
                route: rxRoute,
                timing: rxTiming,
                days: parseInt(rxDuration || "0", 10) || 0,
                qty: parseFloat(rxQty || "0") || 0,
                slots: rxSlots,
            },
            created_at: new Date().toISOString(),
        };

        const next = [tpl, ...(rxTemplates || [])].slice(0, 30);
        setRxTemplates(next);
        try {
            localStorage.setItem(LS_RX_TEMPLATES, JSON.stringify(next || []));
        } catch { }
        setRxTemplateId(tpl.id);
        toast.success("Template saved");
    };

    const deleteTemplate = (id) => {
        const next = (rxTemplates || []).filter((t) => t.id !== id);
        setRxTemplates(next);
        try {
            localStorage.setItem(LS_RX_TEMPLATES, JSON.stringify(next || []));
        } catch { }
        if (rxTemplateId === id) setRxTemplateId("");
        toast.success("Template deleted");
    };

    const copyScheduleText = () => {
        const s = slotsToFreq(rxSlots);
        navigator.clipboard?.writeText(s).then(
            () => toast.success(`Copied: ${s}`),
            () => toast.error("Copy failed")
        );
    };

    // ------------------------------------------------------
    // Details open
    // ------------------------------------------------------
    const openDetails = async (type, item) => {
        setDetailsType(type);
        setDetailsItem(item);
        setDetailsOpen(true);
        setDetailsFull(null);

        try {
            setDetailsLoading(true);
            if (type === "rx" && item?.id) {
                const full = await getRxDetails(item.id);
                setDetailsFull(full);
                return;
            }
            setDetailsFull(item);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load details");
            setDetailsFull(item);
        } finally {
            setDetailsLoading(false);
        }
    };

    // ------------------------------------------------------
    // UI
    // ------------------------------------------------------
    return (
        <>
            <motion.div className="w-full" {...fadeIn}>
                {/* Premium outer shell */}
                <div className="rounded-[30px] bg-gradient-to-br from-slate-50 via-white to-slate-100 p-[1px] shadow-[0_26px_70px_rgba(15,23,42,0.12)]">
                    <Card className="border-0 bg-white/70 backdrop-blur-xl rounded-[30px] overflow-hidden">
                        {/* Header */}
                        <CardHeader className="border-b border-slate-100 pb-4">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center shadow-sm">
                                            <Activity className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base sm:text-lg font-semibold text-slate-900">
                                                Quick Orders
                                            </CardTitle>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Premium workflow — order Lab / Radiology / Pharmacy / OT from one place.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <Badge className="bg-slate-900 text-slate-50 px-3 py-1 rounded-full">
                                            {contextLabel}
                                        </Badge>

                                        <Badge
                                            variant="outline"
                                            className="flex items-center gap-1.5 border-slate-300 bg-white/80 rounded-full"
                                        >
                                            <Hash className="h-3 w-3 text-slate-500" />
                                            <span className="font-medium text-slate-800">
                                                {contextNumberLabel}
                                            </span>
                                        </Badge>

                                        {bedInfo && (
                                            <Badge
                                                variant="outline"
                                                className="flex items-center gap-1.5 border-emerald-300 bg-emerald-50/90 rounded-full"
                                            >
                                                <BedDouble className="h-3 w-3 text-emerald-600" />
                                                <span className="font-medium text-emerald-700">
                                                    {bedInfo}
                                                </span>
                                            </Badge>
                                        )}

                                        {/* OPD Visit summary PDF actions (keep) */}
                                        {ctx === "opd" && contextId && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <PremiumButton
                                                    tone="slate"
                                                    variant="outline"
                                                    className="h-9 text-[11px]"
                                                    onClick={() => visitPdfActions("view")}
                                                    type="button"
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Visit PDF
                                                </PremiumButton>
                                                <PremiumButton
                                                    tone="slate"
                                                    variant="outline"
                                                    className="h-9 text-[11px]"
                                                    onClick={() => visitPdfActions("print")}
                                                    type="button"
                                                >
                                                    <Printer className="h-4 w-4 mr-2" />
                                                    Print
                                                </PremiumButton>
                                                <PremiumButton
                                                    tone="slate"
                                                    variant="solid"
                                                    className="h-9 text-[11px]"
                                                    onClick={() => visitPdfActions("download")}
                                                    type="button"
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Download
                                                </PremiumButton>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Patient Snapshot (premium pills) */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <IconPill
                                        icon={User}
                                        tone="slate"
                                        title="Patient"
                                        subtitle={safePatientName(patient)}
                                    />
                                    <IconPill
                                        icon={Clock}
                                        tone="slate"
                                        title="Demographics"
                                        subtitle={safeGenderAge(patient)}
                                    />

                                    <PremiumButton
                                        type="button"
                                        tone="slate"
                                        variant="outline"
                                        className="h-10 ml-auto"
                                        onClick={() => {
                                            loadSummary();
                                            toast.success("Refreshed");
                                        }}
                                    >
                                        <RefreshCcw className="h-4 w-4 mr-2" />
                                        Refresh
                                    </PremiumButton>
                                </div>
                            </div>
                        </CardHeader>

                        {/* Body */}
                        <CardContent className="p-3 sm:p-4">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.95fr)]">
                                {/* LEFT: Forms */}
                                <div className="space-y-3">
                                    <Tabs
                                        value={activeTab}
                                        onValueChange={setActiveTab}
                                        className="w-full"
                                    >
                                        <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-white/70 border border-slate-200 p-1 sticky top-0 z-10 backdrop-blur">
                                            <TabsTrigger
                                                value="lab"
                                                className="flex items-center gap-1.5 text-xs sm:text-[13px] rounded-xl"
                                            >
                                                <FlaskConical className="h-3.5 w-3.5" />
                                                Lab
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="ris"
                                                className="flex items-center gap-1.5 text-xs sm:text-[13px] rounded-xl"
                                            >
                                                <Radio className="h-3.5 w-3.5" />
                                                Radiology
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="rx"
                                                className="flex items-center gap-1.5 text-xs sm:text-[13px] rounded-xl"
                                            >
                                                <Pill className="h-3.5 w-3.5" />
                                                Pharmacy
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="ot"
                                                className="flex items-center gap-1.5 text-xs sm:text-[13px] rounded-xl"
                                            >
                                                <ScissorsLineDashed className="h-3.5 w-3.5" />
                                                OT
                                            </TabsTrigger>
                                        </TabsList>

                                        {/* ---------- LAB TAB ---------- */}
                                        <TabsContent value="lab" className="mt-3">
                                            <div className="space-y-3">
                                                <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-semibold text-slate-900">
                                                                Lab Order
                                                            </div>
                                                            <div className="text-[12px] text-slate-500 mt-1">
                                                                Select tests → priority → place order.
                                                            </div>
                                                        </div>
                                                        <StatusChip tone="lab">
                                                            {labSelectedTests.length} selected
                                                        </StatusChip>
                                                    </div>
                                                </div>

                                                <div className="grid sm:grid-cols-[2fr_minmax(0,1fr)] gap-3">
                                                    <div ref={labDropRef} className="space-y-1.5 relative">
                                                        <label className="text-xs font-medium text-slate-600">
                                                            Lab test (from Masters)
                                                        </label>
                                                        <div className="relative">
                                                            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                            <Input
                                                                value={labQuery}
                                                                onChange={(e) => {
                                                                    setLabQuery(e.target.value);
                                                                    setShowLabDropdown(true);
                                                                }}
                                                                placeholder="Search test code / name…"
                                                                className="h-10 text-xs pl-7 rounded-2xl"
                                                            />
                                                        </div>

                                                        {showLabDropdown &&
                                                            (labOptions.length > 0 || labSearching) && (
                                                                <div className="absolute z-20 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl max-h-56 overflow-auto text-xs">
                                                                    {labSearching && (
                                                                        <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            Searching…
                                                                        </div>
                                                                    )}
                                                                    {!labSearching && !labOptions.length && (
                                                                        <div className="px-3 py-2 text-slate-500">
                                                                            No tests found.
                                                                        </div>
                                                                    )}
                                                                    {!labSearching &&
                                                                        labOptions.map((t) => (
                                                                            <button
                                                                                key={t.id}
                                                                                type="button"
                                                                                onClick={() => handleSelectLabTest(t)}
                                                                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                            >
                                                                                <span className="font-medium text-slate-900">
                                                                                    {t.name || t.test_name}
                                                                                </span>
                                                                                <span className="text-[11px] text-slate-500">
                                                                                    {t.code || t.short_code || "—"}
                                                                                </span>
                                                                            </button>
                                                                        ))}
                                                                </div>
                                                            )}
                                                        <p className="text-[11px] text-slate-500">
                                                            Linked to LIS Lab Test Masters.
                                                        </p>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium text-slate-600">
                                                            Priority
                                                        </label>
                                                        <div className="flex gap-1.5">
                                                            {["routine", "urgent", "stat"].map((p) => {
                                                                const active = labPriority === p;
                                                                return (
                                                                    <PremiumButton
                                                                        key={p}
                                                                        type="button"
                                                                        tone="lab"
                                                                        variant={active ? "solid" : "outline"}
                                                                        className="flex-1 h-9 text-xs"
                                                                        onClick={() => setLabPriority(p)}
                                                                    >
                                                                        {p === "routine"
                                                                            ? "Routine"
                                                                            : p === "urgent"
                                                                                ? "Urgent"
                                                                                : "STAT"}
                                                                    </PremiumButton>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {labSelectedTests.length > 0 && (
                                                    <ScrollArea className="max-h-40 rounded-2xl border border-slate-200 bg-slate-50/60 p-2">
                                                        <ul className="space-y-1.5 text-xs">
                                                            {labSelectedTests.map((t) => (
                                                                <li
                                                                    key={t.id}
                                                                    className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 border border-slate-100"
                                                                >
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="font-semibold text-slate-900 truncate">
                                                                            {t.name || "Lab test"}
                                                                        </span>
                                                                        <span className="text-[11px] text-slate-500 truncate">
                                                                            Code: {t.code || "—"}
                                                                        </span>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-9 w-9 text-slate-400 hover:text-red-500 rounded-2xl"
                                                                        onClick={() => handleRemoveLabTest(t.id)}
                                                                        title="Remove"
                                                                    >
                                                                        ×
                                                                    </Button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </ScrollArea>
                                                )}

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Note (optional)
                                                    </label>
                                                    <Textarea
                                                        rows={2}
                                                        value={labNote}
                                                        onChange={(e) => setLabNote(e.target.value)}
                                                        placeholder="Special instructions for sample collection / processing."
                                                        className="resize-none text-xs rounded-2xl"
                                                    />
                                                </div>

                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                    <div className="text-[11px] text-slate-500">
                                                        PDF available after reporting (View/Print/Download from details).
                                                    </div>
                                                    <PremiumButton
                                                        type="button"
                                                        tone="lab"
                                                        variant="solid"
                                                        disabled={labSubmitting || !canUseContext}
                                                        onClick={handleSubmitLab}
                                                        className="h-10 px-5 text-xs"
                                                    >
                                                        {labSubmitting ? "Placing Lab Order…" : "Place Lab Order"}
                                                    </PremiumButton>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        {/* ---------- RIS TAB ---------- */}
                                        <TabsContent value="ris" className="mt-3">
                                            <div className="space-y-3">
                                                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-[11px] text-indigo-800 flex items-start gap-2">
                                                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                                                    <div>RIS supports order creation here.</div>
                                                </div>

                                                <div className="grid sm:grid-cols-[2fr_minmax(0,1fr)] gap-3">
                                                    <div ref={risDropRef} className="space-y-1.5 relative">
                                                        <label className="text-xs font-medium text-slate-600">
                                                            Radiology test (from RIS Masters)
                                                        </label>
                                                        <div className="relative">
                                                            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                            <Input
                                                                value={risQuery}
                                                                onChange={(e) => {
                                                                    setRisQuery(e.target.value);
                                                                    setShowRisDropdown(true);
                                                                }}
                                                                placeholder="Search X-Ray / CT / MRI / USG…"
                                                                className="h-10 text-xs pl-7 rounded-2xl"
                                                            />
                                                        </div>

                                                        {showRisDropdown &&
                                                            (risOptions.length > 0 || risSearching) && (
                                                                <div className="absolute z-20 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl max-h-56 overflow-auto text-xs">
                                                                    {risSearching && (
                                                                        <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            Searching…
                                                                        </div>
                                                                    )}
                                                                    {!risSearching && !risOptions.length && (
                                                                        <div className="px-3 py-2 text-slate-500">
                                                                            No tests found.
                                                                        </div>
                                                                    )}
                                                                    {!risSearching &&
                                                                        risOptions.map((t) => (
                                                                            <button
                                                                                key={t.id}
                                                                                type="button"
                                                                                onClick={() => handleSelectRisTest(t)}
                                                                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                            >
                                                                                <div className="flex justify-between items-center gap-2">
                                                                                    <span className="font-medium text-slate-900 truncate">
                                                                                        {t.name || t.test_name}
                                                                                    </span>
                                                                                    <span className="text-[10px] text-slate-500 shrink-0">
                                                                                        {t.modality || t.modality_code || "—"}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-[11px] text-slate-500 truncate">
                                                                                    {t.code || "—"}
                                                                                </span>
                                                                            </button>
                                                                        ))}
                                                                </div>
                                                            )}

                                                        <p className="text-[11px] text-slate-500">
                                                            Linked to Radiology masters.
                                                        </p>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium text-slate-600">
                                                            Priority
                                                        </label>
                                                        <div className="flex gap-1.5">
                                                            {["routine", "urgent", "stat"].map((p) => {
                                                                const active = risPriority === p;
                                                                return (
                                                                    <PremiumButton
                                                                        key={p}
                                                                        type="button"
                                                                        tone="ris"
                                                                        variant={active ? "solid" : "outline"}
                                                                        className="flex-1 h-9 text-xs"
                                                                        onClick={() => setRisPriority(p)}
                                                                    >
                                                                        {p === "routine"
                                                                            ? "Routine"
                                                                            : p === "urgent"
                                                                                ? "Urgent"
                                                                                : "STAT"}
                                                                    </PremiumButton>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {risSelectedTests.length > 0 && (
                                                    <ScrollArea className="max-h-40 rounded-2xl border border-slate-200 bg-slate-50/60 p-2">
                                                        <ul className="space-y-1.5 text-xs">
                                                            {risSelectedTests.map((t) => (
                                                                <li
                                                                    key={t.id}
                                                                    className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 border border-slate-100"
                                                                >
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="font-semibold text-slate-900 truncate">
                                                                            {t.name || "Radiology test"}
                                                                        </span>
                                                                        <span className="text-[11px] text-slate-500 truncate">
                                                                            {t.modality || "RIS"} • Code: {t.code || "—"}
                                                                        </span>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-9 w-9 text-slate-400 hover:text-red-500 rounded-2xl"
                                                                        onClick={() => handleRemoveRisTest(t.id)}
                                                                        title="Remove"
                                                                    >
                                                                        ×
                                                                    </Button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </ScrollArea>
                                                )}

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Note (optional)
                                                    </label>
                                                    <Textarea
                                                        rows={2}
                                                        value={risNote}
                                                        onChange={(e) => setRisNote(e.target.value)}
                                                        placeholder="Side / position / contrast / clinical history etc."
                                                        className="resize-none text-xs rounded-2xl"
                                                    />
                                                </div>

                                                <div className="flex justify-end">
                                                    <PremiumButton
                                                        type="button"
                                                        tone="ris"
                                                        variant="solid"
                                                        disabled={risSubmitting || !canUseContext}
                                                        onClick={handleSubmitRis}
                                                        className="h-10 px-5 text-xs"
                                                    >
                                                        {risSubmitting
                                                            ? "Placing Radiology Order…"
                                                            : "Place Radiology Order"}
                                                    </PremiumButton>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        {/* ---------- PHARMACY TAB ---------- */}
                                        <TabsContent value="rx" className="mt-3">
                                            <div className="space-y-3">
                                                <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-4">
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Sparkles className="h-4 w-4 text-emerald-600" />
                                                            <div>
                                                                <div className="text-xs font-semibold text-slate-900">
                                                                    Macros & Templates
                                                                </div>
                                                                <div className="text-[11px] text-slate-500">
                                                                    Fast Rx creation — schedule macros + reusable templates.
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <PremiumButton
                                                                type="button"
                                                                tone="rx"
                                                                variant="outline"
                                                                className="h-9 text-[11px]"
                                                                onClick={copyScheduleText}
                                                            >
                                                                <ClipboardCopy className="h-4 w-4 mr-2" />
                                                                Copy schedule
                                                            </PremiumButton>

                                                            <PremiumButton
                                                                type="button"
                                                                tone="rx"
                                                                variant="outline"
                                                                className="h-9 text-[11px]"
                                                                onClick={saveCurrentAsTemplate}
                                                            >
                                                                <FileText className="h-4 w-4 mr-2" />
                                                                Save template
                                                            </PremiumButton>

                                                            <select
                                                                className="h-9 rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-800"
                                                                value={rxTemplateId}
                                                                onChange={(e) => {
                                                                    const id = e.target.value;
                                                                    setRxTemplateId(id);
                                                                    const tpl = (rxTemplates || []).find(
                                                                        (t) => t.id === id
                                                                    );
                                                                    if (tpl) applyTemplate(tpl);
                                                                }}
                                                            >
                                                                <option value="">Select template…</option>
                                                                {(rxTemplates || []).map((t) => (
                                                                    <option key={t.id} value={t.id}>
                                                                        {t.name}
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            {rxTemplateId && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    className="h-9 rounded-2xl text-[11px] text-rose-600 hover:text-rose-700"
                                                                    onClick={() => deleteTemplate(rxTemplateId)}
                                                                    title="Delete selected template"
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Delete
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                                                        {["OD", "BD", "TID", "QID", "NIGHT"].map((m) => (
                                                            <PremiumButton
                                                                key={m}
                                                                type="button"
                                                                tone="rx"
                                                                variant="outline"
                                                                className="h-9 rounded-full text-[11px]"
                                                                onClick={() => applyRxMacro(m)}
                                                            >
                                                                {m}
                                                            </PremiumButton>
                                                        ))}
                                                        <span className="ml-1 text-[11px] text-slate-500 inline-flex items-center">
                                                            Schedule:{" "}
                                                            <span className="ml-1 font-semibold text-slate-900">
                                                                {slotsToFreq(rxSlots)}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Medicine search */}
                                                <div ref={rxDropRef} className="space-y-1.5 relative">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Search medicine (Pharmacy Inventory)
                                                    </label>
                                                    <div className="relative">
                                                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-3" />
                                                        <Input
                                                            value={rxQuery}
                                                            onChange={(e) => {
                                                                setRxQuery(e.target.value);
                                                                setShowRxDropdown(true);
                                                            }}
                                                            placeholder="Search drug name / brand / generic…"
                                                            className="h-10 text-xs pl-7 rounded-2xl"
                                                        />
                                                    </div>

                                                    {showRxDropdown &&
                                                        (rxOptions.length > 0 || rxSearching) && (
                                                            <div className="absolute z-20 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl max-h-56 overflow-auto text-xs">
                                                                {rxSearching && (
                                                                    <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        Searching…
                                                                    </div>
                                                                )}
                                                                {!rxSearching && !rxOptions.length && (
                                                                    <div className="px-3 py-2 text-slate-500">
                                                                        No items found.
                                                                    </div>
                                                                )}
                                                                {!rxSearching &&
                                                                    rxOptions.map((it) => (
                                                                        <button
                                                                            key={it.id}
                                                                            type="button"
                                                                            onClick={() => handleSelectRxItem(it)}
                                                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                        >
                                                                            <div className="flex justify-between items-center gap-2">
                                                                                <span className="font-medium text-slate-900 truncate">
                                                                                    {it.name}
                                                                                </span>
                                                                                {it.code && (
                                                                                    <span className="text-[10px] text-slate-500 shrink-0">
                                                                                        {it.code}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[11px] text-slate-500 truncate">
                                                                                {it.strength || it.form || ""}
                                                                            </span>
                                                                        </button>
                                                                    ))}
                                                            </div>
                                                        )}
                                                </div>

                                                {/* Dose/Days/Qty + Timing */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] text-slate-600">
                                                            Dosage
                                                        </label>
                                                        <Input
                                                            value={rxDose}
                                                            onChange={(e) => setRxDose(e.target.value)}
                                                            placeholder="e.g. 500mg / 1 tab"
                                                            className="h-9 text-[11px] rounded-2xl"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] text-slate-600">
                                                            Days
                                                        </label>
                                                        <Input
                                                            value={rxDuration}
                                                            onChange={(e) => setRxDuration(e.target.value)}
                                                            placeholder="5"
                                                            className="h-9 text-[11px] rounded-2xl"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] text-slate-600">
                                                            Qty
                                                        </label>
                                                        <Input
                                                            value={rxQty}
                                                            onChange={(e) => setRxQty(e.target.value)}
                                                            placeholder="10"
                                                            className="h-9 text-[11px] rounded-2xl"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] text-slate-600">
                                                            Timing
                                                        </label>
                                                        <select
                                                            className="h-9 w-full rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-800"
                                                            value={rxTiming}
                                                            onChange={(e) => setRxTiming(e.target.value)}
                                                        >
                                                            <option value="BF">Before food (BF)</option>
                                                            <option value="AF">After food (AF)</option>
                                                            <option value="NA">No timing</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] text-slate-600">
                                                            Route
                                                        </label>
                                                        <select
                                                            className="h-9 w-full rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-800"
                                                            value={rxRoute}
                                                            onChange={(e) => setRxRoute(e.target.value)}
                                                        >
                                                            <option value="oral">Oral</option>
                                                            <option value="iv">IV</option>
                                                            <option value="im">IM</option>
                                                            <option value="topical">Topical</option>
                                                            <option value="inhalation">Inhalation</option>
                                                            <option value="other">Other</option>
                                                        </select>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[11px] text-slate-600">
                                                            Schedule (AM / AF / PM / NIGHT)
                                                        </label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {[
                                                                ["am", "AM"],
                                                                ["af", "AF"],
                                                                ["pm", "PM"],
                                                                ["night", "NIGHT"],
                                                            ].map(([k, label]) => {
                                                                const on = !!rxSlots[k];
                                                                return (
                                                                    <button
                                                                        key={k}
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setRxSlots((s) => ({ ...s, [k]: !s[k] }))
                                                                        }
                                                                        className={cx(
                                                                            "h-9 px-4 rounded-full border text-[11px] font-semibold transition-all",
                                                                            on
                                                                                ? TONE.rx.solid
                                                                                : "bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                                                                        )}
                                                                    >
                                                                        {label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <PremiumButton
                                                        type="button"
                                                        tone="rx"
                                                        variant="solid"
                                                        className="h-9 px-4 text-[11px] rounded-full"
                                                        onClick={handleAddRxLine}
                                                    >
                                                        Add line
                                                    </PremiumButton>
                                                </div>

                                                {/* Lines preview */}
                                                {rxLines.length > 0 && (
                                                    <div className="border border-slate-200 rounded-2xl bg-slate-50/60 overflow-hidden">
                                                        <ScrollArea className="max-h-60">
                                                            <div className="min-w-[860px]">
                                                                <table className="w-full text-[11px]">
                                                                    <thead className="bg-slate-100 text-slate-700">
                                                                        <tr>
                                                                            <th className="px-2 py-2 text-left font-semibold">
                                                                                S.NO
                                                                            </th>
                                                                            <th className="px-2 py-2 text-left font-semibold">
                                                                                Drug/Medicine
                                                                            </th>
                                                                            <th className="px-2 py-2 text-left font-semibold">
                                                                                Dosage
                                                                            </th>
                                                                            <th className="px-2 py-2 text-center font-semibold">
                                                                                AM
                                                                            </th>
                                                                            <th className="px-2 py-2 text-center font-semibold">
                                                                                AF
                                                                            </th>
                                                                            <th className="px-2 py-2 text-center font-semibold">
                                                                                PM
                                                                            </th>
                                                                            <th className="px-2 py-2 text-center font-semibold">
                                                                                NIGHT
                                                                            </th>
                                                                            <th className="px-2 py-2 text-center font-semibold">
                                                                                DAYS
                                                                            </th>
                                                                            <th className="px-2 py-2 text-right font-semibold">
                                                                                Qty
                                                                            </th>
                                                                            <th className="px-2 py-2 text-right font-semibold">
                                                                                Action
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="bg-white">
                                                                        {rxLines.map((l, idx) => {
                                                                            const s = freqToSlots(l.frequency_code);
                                                                            const dosage = [l.dose_text, l.route, l.timing]
                                                                                .filter(Boolean)
                                                                                .join(" • ");
                                                                            return (
                                                                                <tr
                                                                                    key={idx}
                                                                                    className="border-t border-slate-100"
                                                                                >
                                                                                    <td className="px-2 py-2 text-slate-500">
                                                                                        {idx + 1}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 font-medium text-slate-900">
                                                                                        {l.item_name}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-slate-700">
                                                                                        {dosage || "—"}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center font-semibold">
                                                                                        {s.am}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center font-semibold">
                                                                                        {s.af}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center font-semibold">
                                                                                        {s.pm}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center font-semibold">
                                                                                        {s.night}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center font-semibold">
                                                                                        {l.duration_days ?? "—"}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-right font-semibold text-slate-800">
                                                                                        {l.requested_qty}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-right">
                                                                                        <Button
                                                                                            type="button"
                                                                                            size="icon"
                                                                                            variant="ghost"
                                                                                            className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-2xl"
                                                                                            onClick={() => handleRemoveRxLine(idx)}
                                                                                            title="Remove"
                                                                                        >
                                                                                            ×
                                                                                        </Button>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                )}

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Clinical notes / Rx note (optional)
                                                    </label>
                                                    <Textarea
                                                        rows={2}
                                                        value={rxNote}
                                                        onChange={(e) => setRxNote(e.target.value)}
                                                        className="resize-none text-xs rounded-2xl"
                                                    />
                                                </div>

                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                    <div className="text-[11px] text-slate-500">
                                                        Creates patient-ready Prescription PDF (View/Print/Download).
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 justify-end">
                                                        {lastRx?.id && (
                                                            <>
                                                                <PremiumButton
                                                                    type="button"
                                                                    tone="rx"
                                                                    variant="outline"
                                                                    className="h-10"
                                                                    onClick={() => rxActions(lastRx.id, "view")}
                                                                >
                                                                    <Eye className="h-4 w-4 mr-2" />
                                                                    View PDF
                                                                </PremiumButton>
                                                                <PremiumButton
                                                                    type="button"
                                                                    tone="rx"
                                                                    variant="outline"
                                                                    className="h-10"
                                                                    onClick={() => rxActions(lastRx.id, "print")}
                                                                >
                                                                    <Printer className="h-4 w-4 mr-2" />
                                                                    Print
                                                                </PremiumButton>
                                                                <PremiumButton
                                                                    type="button"
                                                                    tone="rx"
                                                                    variant="solid"
                                                                    className="h-10"
                                                                    onClick={() => rxActions(lastRx.id, "download")}
                                                                >
                                                                    <Download className="h-4 w-4 mr-2" />
                                                                    Download
                                                                </PremiumButton>
                                                            </>
                                                        )}

                                                        <PremiumButton
                                                            type="button"
                                                            tone="rx"
                                                            variant="solid"
                                                            disabled={rxSubmitting || !canUseContext}
                                                            onClick={handleSubmitRx}
                                                            className="h-10 px-5 text-xs"
                                                        >
                                                            {rxSubmitting ? "Saving Rx…" : "Save & Send to Pharmacy"}
                                                        </PremiumButton>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        {/* ---------- OT TAB ---------- */}
                                        <TabsContent value="ot" className="mt-3">
                                            <div className="space-y-3">
                                                {ctx !== "ipd" && (
                                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex items-start gap-2">
                                                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                                                        OT quick booking is only for IPD admission context.
                                                    </div>
                                                )}

                                                <div className="grid sm:grid-cols-3 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium text-slate-600">
                                                            OT Date <span className="text-rose-500">*</span>
                                                        </label>
                                                        <Input
                                                            type="date"
                                                            value={otDate}
                                                            onChange={(e) => setOtDate(e.target.value)}
                                                            className="h-10 text-xs rounded-2xl"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium text-slate-600">
                                                            Start time <span className="text-rose-500">*</span>
                                                        </label>
                                                        <Input
                                                            type="time"
                                                            value={otStart}
                                                            onChange={(e) => setOtStart(e.target.value)}
                                                            className="h-10 text-xs rounded-2xl"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium text-slate-600">
                                                            End time (optional)
                                                        </label>
                                                        <Input
                                                            type="time"
                                                            value={otEnd}
                                                            onChange={(e) => setOtEnd(e.target.value)}
                                                            className="h-10 text-xs rounded-2xl"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        OT Location / Bed
                                                    </label>
                                                    <WardRoomBedPicker
                                                        value={otBedId ? Number(otBedId) : null}
                                                        onChange={(bedId) => setOtBedId(bedId || null)}
                                                    />
                                                </div>

                                                <div ref={otDropRef} className="space-y-1.5 relative">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Procedure (OT Master or free text)
                                                    </label>
                                                    <div className="relative">
                                                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-3" />
                                                        <Input
                                                            value={otProcedureQuery}
                                                            onChange={(e) => {
                                                                setOtProcedureQuery(e.target.value);
                                                                setShowOtDropdown(true);
                                                            }}
                                                            placeholder="Search procedure name / code…"
                                                            className="h-10 text-xs pl-7 rounded-2xl"
                                                        />
                                                    </div>

                                                    {showOtDropdown &&
                                                        (otProcedureOptions.length > 0 ||
                                                            otProcedureSearching) && (
                                                            <div className="absolute z-20 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl max-h-56 overflow-auto text-xs">
                                                                {otProcedureSearching && (
                                                                    <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        Searching…
                                                                    </div>
                                                                )}
                                                                {!otProcedureSearching &&
                                                                    !otProcedureOptions.length && (
                                                                        <div className="px-3 py-2 text-slate-500">
                                                                            No procedures found.
                                                                        </div>
                                                                    )}
                                                                {!otProcedureSearching &&
                                                                    otProcedureOptions.map((p) => (
                                                                        <button
                                                                            key={p.id}
                                                                            type="button"
                                                                            onClick={() => handleSelectOtProcedure(p)}
                                                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                        >
                                                                            <span className="font-medium text-slate-900">
                                                                                {p.name || p.procedure_name}
                                                                            </span>
                                                                            <span className="text-[11px] text-slate-500">
                                                                                {p.code || "—"}
                                                                            </span>
                                                                        </button>
                                                                    ))}
                                                            </div>
                                                        )}
                                                </div>

                                                <div className="grid sm:grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium text-slate-600">
                                                            Side
                                                        </label>
                                                        <select
                                                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800"
                                                            value={otSide}
                                                            onChange={(e) => setOtSide(e.target.value)}
                                                        >
                                                            <option value="">Not applicable</option>
                                                            <option value="Right">Right</option>
                                                            <option value="Left">Left</option>
                                                            <option value="Bilateral">Bilateral</option>
                                                            <option value="Midline">Midline</option>
                                                        </select>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium text-slate-600">
                                                            Priority
                                                        </label>
                                                        <div className="flex gap-1.5">
                                                            {["Elective", "Emergency"].map((p) => {
                                                                const active = otPriority === p;
                                                                return (
                                                                    <PremiumButton
                                                                        key={p}
                                                                        type="button"
                                                                        tone="ot"
                                                                        variant={active ? "solid" : "outline"}
                                                                        className="flex-1 h-9 text-xs"
                                                                        onClick={() => setOtPriority(p)}
                                                                    >
                                                                        {p}
                                                                    </PremiumButton>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid sm:grid-cols-2 gap-3">
                                                    <DoctorPicker
                                                        label="Surgeon"
                                                        value={otSurgeonId ? Number(otSurgeonId) : null}
                                                        onChange={(id) => setOtSurgeonId(id || null)}
                                                    />
                                                    <DoctorPicker
                                                        label="Anaesthetist"
                                                        value={
                                                            otAnaesthetistId ? Number(otAnaesthetistId) : null
                                                        }
                                                        onChange={(id) => setOtAnaesthetistId(id || null)}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Notes / anaesthesia plan (optional)
                                                    </label>
                                                    <Textarea
                                                        rows={2}
                                                        value={otNote}
                                                        onChange={(e) => setOtNote(e.target.value)}
                                                        className="resize-none text-xs rounded-2xl"
                                                    />
                                                </div>

                                                <div className="flex justify-end">
                                                    <PremiumButton
                                                        type="button"
                                                        tone="ot"
                                                        variant="solid"
                                                        disabled={otSubmitting || !canUseContext || ctx !== "ipd"}
                                                        onClick={handleSubmitOt}
                                                        className="h-10 px-5 text-xs"
                                                    >
                                                        {otSubmitting ? "Creating OT schedule…" : "Create OT schedule"}
                                                    </PremiumButton>
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>

                                {/* RIGHT: Summary (Follow-ups removed) */}
                                <div className="space-y-3 lg:sticky lg:top-3 self-start">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                                            Recent orders (this {contextLabel.toLowerCase()})
                                        </h3>
                                        {loadingSummary && (
                                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Loading
                                            </span>
                                        )}
                                    </div>

                                    {/* LAB SUMMARY */}
                                    <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FlaskConical className="h-4 w-4 text-sky-600" />
                                                <CardTitle className="text-xs font-semibold">
                                                    Lab Orders
                                                </CardTitle>
                                            </div>
                                            <StatusChip tone="lab">{summary.lab?.length || 0} orders</StatusChip>
                                        </CardHeader>
                                        <CardContent className="px-4 pb-4 pt-0">
                                            <div className="space-y-2 max-h-40 overflow-auto text-[11px]">
                                                {!summary.lab?.length && !loadingSummary && (
                                                    <div className="text-slate-500 text-[12px]">
                                                        No lab orders for this context yet.
                                                    </div>
                                                )}
                                                {summary.lab?.map((o) => (
                                                    <div key={o.id} className="flex items-stretch gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openDetails("lab", o)}
                                                            className="flex-1 text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-slate-900 truncate">
                                                                    {o.order_no || `LAB-${String(o.id).padStart(6, "0")}`}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 truncate">
                                                                    {fmtDT(o.created_at || o.order_datetime)}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-600 capitalize shrink-0">
                                                                {o.status || "ordered"}
                                                            </span>
                                                        </button>

                                                        <PremiumButton
                                                            type="button"
                                                            tone="lab"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10"
                                                            title="View PDF"
                                                            onClick={() => labPdfActions(o.id, "view")}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </PremiumButton>
                                                        <PremiumButton
                                                            type="button"
                                                            tone="lab"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10"
                                                            title="Download PDF"
                                                            onClick={() => labPdfActions(o.id, "download")}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </PremiumButton>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* RIS SUMMARY */}
                                    <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Radio className="h-4 w-4 text-indigo-600" />
                                                <CardTitle className="text-xs font-semibold">
                                                    Radiology Orders
                                                </CardTitle>
                                            </div>
                                            <StatusChip tone="ris">{summary.ris?.length || 0} orders</StatusChip>
                                        </CardHeader>
                                        <CardContent className="px-4 pb-4 pt-0">
                                            <div className="space-y-2 max-h-40 overflow-auto text-[11px]">
                                                {!summary.ris?.length && !loadingSummary && (
                                                    <div className="text-slate-500 text-[12px]">
                                                        No radiology orders for this context yet.
                                                    </div>
                                                )}
                                                {summary.ris?.map((o) => (
                                                    <button
                                                        key={o.id}
                                                        type="button"
                                                        onClick={() => openDetails("ris", o)}
                                                        className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                                    >
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-semibold text-slate-900 truncate">
                                                                {o.order_no || `RIS-${String(o.id).padStart(6, "0")}`}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 truncate">
                                                                {fmtDT(o.created_at || o.order_datetime)}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-600 capitalize shrink-0">
                                                            {o.status || "ordered"}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* RX SUMMARY */}
                                    <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Pill className="h-4 w-4 text-emerald-600" />
                                                <CardTitle className="text-xs font-semibold">
                                                    Pharmacy Rx
                                                </CardTitle>
                                            </div>
                                            <StatusChip tone="rx">{summary.rx?.length || 0} Rx</StatusChip>
                                        </CardHeader>
                                        <CardContent className="px-4 pb-4 pt-0">
                                            <div className="space-y-2 max-h-40 overflow-auto text-[11px]">
                                                {!summary.rx?.length && !loadingSummary && (
                                                    <div className="text-slate-500 text-[12px]">
                                                        No prescriptions for this context yet.
                                                    </div>
                                                )}
                                                {summary.rx?.map((o) => (
                                                    <div key={o.id} className="flex items-stretch gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openDetails("rx", o)}
                                                            className="flex-1 text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-slate-900 truncate">
                                                                    {o.rx_number || `RX-${String(o.id).padStart(6, "0")}`}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 truncate">
                                                                    {fmtDT(o.rx_datetime || o.created_at)}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-600 capitalize shrink-0">
                                                                {o.status || "pending"}
                                                            </span>
                                                        </button>

                                                        <PremiumButton
                                                            type="button"
                                                            tone="rx"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10"
                                                            title="View PDF"
                                                            onClick={() => rxActions(o.id, "view")}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </PremiumButton>

                                                        <PremiumButton
                                                            type="button"
                                                            tone="rx"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10"
                                                            title="Download PDF"
                                                            onClick={() => rxActions(o.id, "download")}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </PremiumButton>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* OT SUMMARY (IPD only) */}
                                    {ctx === "ipd" && (
                                        <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <ScissorsLineDashed className="h-4 w-4 text-amber-600" />
                                                    <CardTitle className="text-xs font-semibold">
                                                        OT Schedules
                                                    </CardTitle>
                                                </div>
                                                <StatusChip tone="ot">{summary.ot?.length || 0} cases</StatusChip>
                                            </CardHeader>
                                            <CardContent className="px-4 pb-4 pt-0">
                                                <div className="space-y-2 max-h-40 overflow-auto text-[11px]">
                                                    {!summary.ot?.length && !loadingSummary && (
                                                        <div className="text-slate-500 text-[12px]">
                                                            No OT schedules for this admission yet.
                                                        </div>
                                                    )}
                                                    {summary.ot?.map((o) => (
                                                        <button
                                                            key={o.id}
                                                            type="button"
                                                            onClick={() => openDetails("ot", o)}
                                                            className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-slate-900 truncate">
                                                                    {o.case_no || `OT-${String(o.id).padStart(6, "0")}`}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 truncate">
                                                                    {fmtDT(o.created_at || o.scheduled_at)}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-600 capitalize shrink-0">
                                                                {o.status || "planned"}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </motion.div>

            {/* Details Sheet */}
            <Sheet open={detailsOpen} onOpenChange={(v) => (v ? setDetailsOpen(true) : closeDetails())}>
                <SheetContent side="right" className="w-full sm:max-w-xl">
                    <SheetHeader>
                        <SheetTitle className="text-base">
                            {detailsType === "lab" && "Lab Order"}
                            {detailsType === "ris" && "Radiology Order"}
                            {detailsType === "rx" && "Prescription"}
                            {detailsType === "ot" && "OT Schedule"}
                        </SheetTitle>
                        <SheetDescription className="text-xs">
                            {detailsItem?.id ? `ID: ${detailsItem.id}` : ""}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-4 space-y-3">
                        {detailsLoading && (
                            <div className="text-sm text-slate-500 flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                            </div>
                        )}

                        {!detailsLoading && detailsItem && (
                            <div className="space-y-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
                                    <div className="font-semibold text-slate-900">Summary</div>
                                    <div className="mt-1 text-slate-600">
                                        Created:{" "}
                                        <span className="font-semibold text-slate-800">
                                            {fmtDT(detailsItem.created_at || detailsItem.order_datetime)}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-slate-600">
                                        Status:{" "}
                                        <span className="font-semibold text-slate-800">
                                            {detailsItem.status || "—"}
                                        </span>
                                    </div>
                                </div>

                                {/* PDF actions for LAB + RX */}
                                {detailsType === "lab" && detailsItem?.id && (
                                    <div className="flex flex-wrap gap-2">
                                        <PremiumButton tone="lab" variant="outline" className="rounded-2xl" onClick={() => labPdfActions(detailsItem.id, "view")}>
                                            <Eye className="h-4 w-4 mr-2" /> View PDF
                                        </PremiumButton>
                                        <PremiumButton tone="lab" variant="outline" className="rounded-2xl" onClick={() => labPdfActions(detailsItem.id, "print")}>
                                            <Printer className="h-4 w-4 mr-2" /> Print
                                        </PremiumButton>
                                        <PremiumButton tone="lab" variant="solid" className="rounded-2xl" onClick={() => labPdfActions(detailsItem.id, "download")}>
                                            <Download className="h-4 w-4 mr-2" /> Download
                                        </PremiumButton>
                                    </div>
                                )}

                                {detailsType === "rx" && detailsItem?.id && (
                                    <div className="flex flex-wrap gap-2">
                                        <PremiumButton tone="rx" variant="outline" className="rounded-2xl" onClick={() => rxActions(detailsItem.id, "view")}>
                                            <Eye className="h-4 w-4 mr-2" /> View PDF
                                        </PremiumButton>
                                        <PremiumButton tone="rx" variant="outline" className="rounded-2xl" onClick={() => rxActions(detailsItem.id, "print")}>
                                            <Printer className="h-4 w-4 mr-2" /> Print
                                        </PremiumButton>
                                        <PremiumButton tone="rx" variant="solid" className="rounded-2xl" onClick={() => rxActions(detailsItem.id, "download")}>
                                            <Download className="h-4 w-4 mr-2" /> Download
                                        </PremiumButton>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
