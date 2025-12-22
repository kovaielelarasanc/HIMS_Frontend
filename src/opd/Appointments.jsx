// FILE: frontend/src/opd/Appointments.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import {
    createAppointment,
    listAppointments,
    getDoctorSlots,
    updateAppointmentStatus,
    fetchDepartments,
    fetchDepartmentUsers,
} from "../api/opd";

import PatientPicker from "./components/PatientPicker";
import DoctorPicker from "./components/DoctorPicker";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import {
    CalendarDays,
    Clock,
    Stethoscope,
    User2,
    Loader2,
    RefreshCcw,
    Search,
    CheckCircle2,
    XCircle,
    ArrowLeft,
    ArrowRight,
    Hash,
    Phone,
    PlayCircle,
    LogIn,
    Ticket,
    AlertTriangle,
    Filter,
    Sparkles,
    Check,
} from "lucide-react";

/* ---------------------------------------------
   Helpers
--------------------------------------------- */

const todayStr = () => new Date().toISOString().slice(0, 10);

function cx(...xs) {
    return xs.filter(Boolean).join(" ");
}

function normTime(t) {
    if (!t) return "";
    const s = String(t).trim();
    if (!s || s === "—") return "";
    return s.length >= 5 ? s.slice(0, 5) : s;
}

function parseTimeToMinutes(t) {
    const tt = normTime(t);
    if (!tt || !tt.includes(":")) return 0;
    const [hh, mm] = tt.split(":");
    return Number(hh || 0) * 60 + Number(mm || 0);
}

function prettyDate(iso) {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleDateString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return iso;
    }
}

function addDays(isoDate, days) {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function calcAge(dob) {
    if (!dob) return "";
    try {
        const d = new Date(dob);
        if (Number.isNaN(d.getTime())) return "";
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
        return age >= 0 && age < 130 ? String(age) : "";
    } catch {
        return "";
    }
}

function safePatientName(p) {
    if (!p) return "";
    const prefix = p.prefix ? `${p.prefix} ` : "";
    const fn = p.first_name || p.firstname || "";
    const ln = p.last_name || p.lastname || "";
    const full = p.full_name || p.name || "";
    const out = full || `${prefix}${fn} ${ln}`.trim();
    return (out || "").replace(/\s+/g, " ").trim();
}

function initialsFromName(name) {
    const s = String(name || "").trim();
    if (!s) return "P";
    return s
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((x) => x[0]?.toUpperCase())
        .join("");
}

function isFreeSlot(s) {
    if (typeof s === "string") return true;
    return s?.status === "free" || !s?.status;
}

function slotStart(s) {
    if (!s) return "";
    if (typeof s === "string") return normTime(s);
    return normTime(s?.start || s?.slot_start || "");
}

function slotEnd(s) {
    if (!s) return "";
    if (typeof s === "string") return "";
    return normTime(s?.end || s?.slot_end || "");
}

function timeBucket(start) {
    const m = parseTimeToMinutes(start);
    if (m < 12 * 60) return "Morning";
    if (m < 17 * 60) return "Afternoon";
    return "Evening";
}

const statusLabel = {
    booked: "Booked",
    checked_in: "Checked-in",
    in_progress: "In progress",
    completed: "Completed",
    no_show: "No-show",
    cancelled: "Cancelled",
};

function statusMeta(status) {
    const st = String(status || "booked").toLowerCase();
    switch (st) {
        case "booked":
            return {
                ring: "ring-slate-200/70",
                tint: "from-slate-50 to-white",
                border: "border-black/10",
                pill: "border-slate-200 bg-slate-50 text-slate-700",
                icon: <Clock className="h-4 w-4 text-slate-700" />,
                bar: "bg-slate-300",
            };
        case "checked_in":
            return {
                ring: "ring-sky-200/70",
                tint: "from-sky-50 to-white",
                border: "border-sky-200/60",
                pill: "border-sky-200 bg-sky-50 text-sky-900",
                icon: <LogIn className="h-4 w-4 text-sky-800" />,
                bar: "bg-sky-400",
            };
        case "in_progress":
            return {
                ring: "ring-amber-200/70",
                tint: "from-amber-50 to-white",
                border: "border-amber-200/70",
                pill: "border-amber-200 bg-amber-50 text-amber-950",
                icon: <PlayCircle className="h-4 w-4 text-amber-900" />,
                bar: "bg-amber-400",
            };
        case "completed":
            return {
                ring: "ring-emerald-200/70",
                tint: "from-emerald-50 to-white",
                border: "border-emerald-200/70",
                pill: "border-emerald-200 bg-emerald-50 text-emerald-950",
                icon: <CheckCircle2 className="h-4 w-4 text-emerald-800" />,
                bar: "bg-emerald-400",
            };
        case "no_show":
            return {
                ring: "ring-rose-200/70",
                tint: "from-rose-50 to-white",
                border: "border-rose-200/70",
                pill: "border-rose-200 bg-rose-50 text-rose-950",
                icon: <AlertTriangle className="h-4 w-4 text-rose-800" />,
                bar: "bg-rose-400",
            };
        case "cancelled":
            return {
                ring: "ring-slate-200/70",
                tint: "from-slate-100 to-white",
                border: "border-black/10",
                pill: "border-slate-200 bg-slate-100 text-slate-600",
                icon: <XCircle className="h-4 w-4 text-slate-600" />,
                bar: "bg-slate-300",
            };
        default:
            return {
                ring: "ring-slate-200/70",
                tint: "from-slate-50 to-white",
                border: "border-black/10",
                pill: "border-slate-200 bg-slate-50 text-slate-700",
                icon: <Clock className="h-4 w-4 text-slate-700" />,
                bar: "bg-slate-300",
            };
    }
}

/* ---------------------------------------------
   Premium UI tokens
--------------------------------------------- */

const UI = {
    page: "min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-slate-50 via-white to-slate-50",
    stickyTop: " top-0 z-30",
    container: "px-4 py-5 md:px-8 md:py-8",
    glass:
        "rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_14px_42px_rgba(2,6,23,0.08)]",
    chip:
        "inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700",
    pillBtn:
        "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-black/[0.03] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed",
    input:
        "w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500",
};

const fadeIn = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18 },
};

function SegmentedTabs({ value, onChange, tabs, layoutId }) {
    return (
        <div className="inline-flex items-center rounded-full border border-black/10 bg-white/85 p-1 shadow-[0_8px_22px_rgba(2,6,23,0.08)]">
            {tabs.map((t) => {
                const active = value === t.key;
                return (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onChange(t.key)}
                        className={cx(
                            "relative px-3 sm:px-4 py-1.5 rounded-full text-[12px] font-semibold transition",
                            active ? "text-white" : "text-slate-700 hover:bg-black/[0.03]"
                        )}
                    >
                        {active && (
                            <motion.span
                                layoutId={layoutId}
                                className="absolute inset-0 rounded-full bg-slate-900"
                                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                            />
                        )}
                        <span className="relative z-10">{t.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function EmptyState({ title, subtitle, icon }) {
    return (
        <div className="rounded-3xl border border-dashed border-black/15 bg-black/[0.02] px-5 py-7 text-center">
            {icon ? (
                <div className="mx-auto mb-3 h-10 w-10 rounded-3xl border border-black/10 bg-white/70 grid place-items-center">
                    {icon}
                </div>
            ) : null}
            <div className="text-[13px] font-semibold text-slate-900">{title}</div>
            {subtitle ? <div className="mt-1 text-[12px] text-slate-500">{subtitle}</div> : null}
        </div>
    );
}

function StatusPill({ status }) {
    const st = String(status || "booked").toLowerCase();
    const m = statusMeta(st);
    return (
        <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", m.pill)}>
            {m.icon}
            {statusLabel[st] || st}
        </span>
    );
}

function FilterPill({ active, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                active
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-black/10 bg-white/75 text-slate-700 hover:bg-black/[0.03]"
            )}
        >
            {label}
        </button>
    );
}

function ModeBadge({ mode }) {
    const m = String(mode || "").toLowerCase();
    const isFree = m === "free" || m === "token";
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            {isFree ? <Ticket className="h-3.5 w-3.5 text-slate-500" /> : <Clock className="h-3.5 w-3.5 text-slate-500" />}
            {isFree ? "Free" : "Slot"}
        </span>
    );
}

function ApptCard({ a, onStatus }) {
    const st = String(a?.status || "booked").toLowerCase();
    const meta = statusMeta(st);

    const nm = a?.patient_name || a?.patient?.name || "—";
    const uhid = a?.uhid || a?.patient_uhid || a?.patient?.uhid || "—";
    const phone = a?.patient_phone || a?.phone || a?.patient?.phone || "";

    const type = String(a?.appointment_type || "").toLowerCase(); // free | slot
    const slotS = normTime(a?.slot_start);
    const slotE = normTime(a?.slot_end);
    const hasTime = !!slotS;
    const timeLabel = hasTime ? `${slotS}${slotE ? `–${slotE}` : ""}` : "FREE";

    const tokenNo = Number(a?.queue_no || 0) || null;
    const tokenText = tokenNo ? String(tokenNo) : "—";

    const dept = a?.department_name || "";
    const doc = a?.doctor_name || "";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cx("rounded-3xl border overflow-hidden shadow-[0_10px_24px_rgba(2,6,23,0.07)]", meta.border)}
        >
            <div className={cx("relative bg-gradient-to-b", meta.tint)}>
                <div className={cx("absolute left-0 top-0 h-full w-1.5", meta.bar)} />

                <div className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex items-start gap-4">
                            <div className={cx("shrink-0 rounded-3xl border border-black/10 bg-white/80 ring-1", meta.ring)}>
                                <div className="px-4 py-3 text-center">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                        Token
                                    </div>
                                    <div className="mt-1 text-4xl md:text-5xl font-extrabold tabular-nums text-slate-900 leading-none">
                                        {tokenText}
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700 tabular-nums">
                                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                                        {timeLabel}
                                    </span>

                                    <StatusPill status={st} />
                                    {type ? <ModeBadge mode={type} /> : null}

                                    {phone ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                                            {phone}
                                        </span>
                                    ) : null}
                                </div>

                                <div className="mt-2 flex items-start gap-3 min-w-0">
                                    <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl border border-black/10 bg-white/80 text-[12px] font-semibold text-slate-800">
                                        {initialsFromName(nm)}
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="truncate text-[14px] font-semibold text-slate-900">
                                                {nm}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                UHID{" "}
                                                <span className="font-semibold text-slate-700">{uhid}</span>
                                            </div>
                                        </div>

                                        <div className="mt-1 text-[11px] text-slate-500">
                                            {dept ? `${dept} · ` : ""}
                                            {doc ? `Dr. ${doc} · ` : ""}
                                            Purpose:{" "}
                                            <span className="font-semibold text-slate-700">
                                                {a?.purpose || "Consultation"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            {st === "booked" && (
                                <>
                                    <Button
                                        size="sm"
                                        className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                        onClick={() => onStatus(a, "checked_in")}
                                    >
                                        <LogIn className="mr-2 h-4 w-4" />
                                        Check-in
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                        onClick={() => onStatus(a, "no_show")}
                                    >
                                        <AlertTriangle className="mr-2 h-4 w-4" />
                                        No-show
                                    </Button>
                                </>
                            )}

                            {st === "checked_in" && (
                                <Button
                                    size="sm"
                                    className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                    onClick={() => onStatus(a, "in_progress", { goToVisit: true })}
                                >
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    Start visit
                                </Button>
                            )}

                            {st === "in_progress" && (
                                <Button
                                    size="sm"
                                    className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                    onClick={() => onStatus(a, "completed")}
                                >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Complete
                                </Button>
                            )}

                            {(st === "booked" || st === "checked_in") && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                    onClick={() => onStatus(a, "cancelled")}
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default function Appointments() {
    const navigate = useNavigate();

    const today = useMemo(() => todayStr(), []);
    const [pageTab, setPageTab] = useState("list"); // list | book
    const [scope, setScope] = useState("today"); // today | date
    const [date, setDate] = useState(today);
    const activeDate = useMemo(() => (scope === "today" ? today : date), [scope, today, date]);

    // List data
    const [appointments, setAppointments] = useState([]);
    const [loadingAppts, setLoadingAppts] = useState(false);

    // Filters
    const [q, setQ] = useState("");
    const [serverQ, setServerQ] = useState(""); // debounced for backend
    const [status, setStatus] = useState("all");
    const [modeFilter, setModeFilter] = useState("all"); // all | free | slot
    const [deptFilter, setDeptFilter] = useState("all");
    const [doctorFilter, setDoctorFilter] = useState("all");

    // Filter dropdown data (dept/doctors)
    const [depts, setDepts] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loadingDepts, setLoadingDepts] = useState(false);
    const [loadingDoctors, setLoadingDoctors] = useState(false);

    // Booking
    const [bookingMode, setBookingMode] = useState("free"); // free | slot
    const [bookDate, setBookDate] = useState(today);
    const [purpose, setPurpose] = useState("Consultation");

    const [patientId, setPatientId] = useState(null);
    const [patientMeta, setPatientMeta] = useState(null);

    // Selected from DoctorPicker
    const [bookDeptId, setBookDeptId] = useState(null);
    const [bookDoctorId, setBookDoctorId] = useState(null);

    // Slots
    const [slots, setSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState("");
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [showAllSlots, setShowAllSlots] = useState(false);

    // -------------------------
    // Debounce search for backend q
    // -------------------------
    useEffect(() => {
        const t = setTimeout(() => setServerQ(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    // -------------------------
    // Load departments for filter (once)
    // -------------------------
    useEffect(() => {
        let alive = true;
        setLoadingDepts(true);
        fetchDepartments()
            .then((r) => {
                if (!alive) return;
                setDepts(r?.data || []);
            })
            .catch(() => {
                if (!alive) return;
                setDepts([]);
            })
            .finally(() => {
                if (!alive) return;
                setLoadingDepts(false);
            });
        return () => {
            alive = false;
        };
    }, []);

    // -------------------------
    // When deptFilter changes → load doctors for that dept
    // -------------------------
    useEffect(() => {
        let alive = true;
        const did = deptFilter !== "all" ? Number(deptFilter) : null;

        setDoctorFilter("all");
        setDoctors([]);

        if (!did) return;

        setLoadingDoctors(true);
        fetchDepartmentUsers({ departmentId: did, isDoctor: true })
            .then((r) => {
                if (!alive) return;
                setDoctors(r?.data || []);
            })
            .catch(() => {
                if (!alive) return;
                setDoctors([]);
            })
            .finally(() => {
                if (!alive) return;
                setLoadingDoctors(false);
            });

        return () => {
            alive = false;
        };
    }, [deptFilter]);

    // -------------------------
    // Load appointments (ALL by default, server-side filters supported)
    // NOTE: we do NOT send status to backend so Status tabs can work locally
    // -------------------------
    const loadAppointments = useCallback(async () => {
        try {
            setLoadingAppts(true);

            const params = {
                date: activeDate,
                department_id: deptFilter !== "all" ? Number(deptFilter) : undefined,
                doctor_id: doctorFilter !== "all" ? Number(doctorFilter) : undefined,
                appointment_type: modeFilter !== "all" ? modeFilter : undefined,
                q: serverQ ? serverQ : undefined,
                // status intentionally not sent; we filter locally
            };

            const { data } = await listAppointments(params);
            setAppointments(data || []);
        } catch {
            setAppointments([]);
        } finally {
            setLoadingAppts(false);
        }
    }, [activeDate, deptFilter, doctorFilter, modeFilter, serverQ]);

    useEffect(() => {
        loadAppointments();
    }, [loadAppointments]);

    useEffect(() => {
        if (pageTab === "book") setBookDate(activeDate);
    }, [pageTab, activeDate]);

    const refreshAll = async () => {
        await loadAppointments();
    };

    // -------------------------
    // Status counts (based on current server-filtered dataset)
    // -------------------------
    const statusCounts = useMemo(() => {
        const c = { all: appointments.length, booked: 0, checked_in: 0, in_progress: 0, completed: 0, cancelled: 0, no_show: 0 };
        for (const a of appointments || []) {
            const k = String(a?.status || "").toLowerCase();
            if (c[k] !== undefined) c[k] += 1;
        }
        return c;
    }, [appointments]);

    const statusTabs = useMemo(
        () => [
            { key: "all", label: `All (${statusCounts.all})` },
            { key: "booked", label: `Booked (${statusCounts.booked})` },
            { key: "checked_in", label: `Checked-in (${statusCounts.checked_in})` },
            { key: "in_progress", label: `In progress (${statusCounts.in_progress})` },
            { key: "completed", label: `Completed (${statusCounts.completed})` },
            { key: "no_show", label: `No-show (${statusCounts.no_show})` },
            { key: "cancelled", label: `Cancelled (${statusCounts.cancelled})` },
        ],
        [statusCounts]
    );

    const filteredList = useMemo(() => {
        const st = String(status || "all").toLowerCase();
        return (appointments || [])
            .filter((a) => {
                const s = String(a?.status || "booked").toLowerCase();
                if (st !== "all" && s !== st) return false;
                return true;
            })
            .sort((a, b) => {
                const qa = Number(a?.queue_no || 0);
                const qb = Number(b?.queue_no || 0);
                if (qa !== qb) return qa - qb;
                const ta = parseTimeToMinutes(a?.slot_start);
                const tb = parseTimeToMinutes(b?.slot_start);
                if (ta !== tb) return ta - tb;
                return Number(a?.id || 0) - Number(b?.id || 0);
            });
    }, [appointments, status]);

    // -------------------------
    // Booking: patient summary
    // -------------------------
    const patientSummary = useMemo(() => {
        if (!patientId) return null;
        const nm = safePatientName(patientMeta) || `Selected patient #${patientId}`;
        const uhid = patientMeta?.uhid ? String(patientMeta.uhid) : "";
        const dob = patientMeta?.dob || patientMeta?.date_of_birth || "";
        const age = calcAge(dob);
        const sexVal = patientMeta?.sex ?? patientMeta?.gender;
        const sex = sexVal ? String(sexVal).toUpperCase() : "";
        const phone = patientMeta?.phone || patientMeta?.mobile || "";
        return { nm, uhid, age, sex, phone };
    }, [patientId, patientMeta]);

    const handlePatientChange = (id, meta) => {
        const pid = id ? Number(id) : null;
        setPatientId(pid);
        setPatientMeta(meta || null);
    };

    // -------------------------
    // Slots
    // -------------------------
    const apptByStart = useMemo(() => {
        const m = new Map();
        for (const a of appointments || []) {
            const k = normTime(a?.slot_start);
            if (k) m.set(k, a);
        }
        return m;
    }, [appointments]);

    const loadSlots = useCallback(async () => {
        if (bookingMode !== "slot") return;
        if (!bookDoctorId || !bookDate) return;

        try {
            setLoadingSlots(true);
            const { data } = await getDoctorSlots({
                doctor_user_id: Number(bookDoctorId),
                date: bookDate,
                detailed: true,
            });
            const arr = Array.isArray(data) ? data : data?.slots || [];
            setSlots(arr || []);
        } catch {
            setSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    }, [bookingMode, bookDoctorId, bookDate]);

    useEffect(() => {
        if (bookingMode === "free") {
            setSlots([]);
            setSelectedSlot("");
            setLoadingSlots(false);
            return;
        }
        loadSlots();
    }, [bookingMode, loadSlots]);

    // reset slot when doctor changes
    useEffect(() => {
        setSelectedSlot("");
    }, [bookDoctorId, bookDate]);

    const freeSlots = useMemo(() => {
        return (slots || []).filter((s) => {
            const st = slotStart(s);
            const taken = apptByStart.get(st);
            return isFreeSlot(s) && !taken;
        });
    }, [slots, apptByStart]);

    const visibleSlots = useMemo(() => {
        const list = showAllSlots ? (slots || []) : freeSlots;
        return [...list].sort((a, b) => parseTimeToMinutes(slotStart(a)) - parseTimeToMinutes(slotStart(b)));
    }, [slots, freeSlots, showAllSlots]);

    const slotsByBucket = useMemo(() => {
        const map = { Morning: [], Afternoon: [], Evening: [] };
        for (const s of visibleSlots) {
            const st = slotStart(s);
            map[timeBucket(st)].push(s);
        }
        return map;
    }, [visibleSlots]);

    const canBookNow = useMemo(() => {
        if (!patientId || !bookDeptId || !bookDoctorId || !bookDate) return false;
        if (bookingMode === "slot") return !!selectedSlot;
        return true;
    }, [patientId, bookDeptId, bookDoctorId, bookDate, bookingMode, selectedSlot]);

    const book = async (e) => {
        e?.preventDefault?.();

        if (!patientId) return toast.error("Please select a patient");
        if (!bookDeptId) return toast.error("Please select a department");
        if (!bookDoctorId) return toast.error("Please select a doctor");
        if (bookingMode === "slot" && !selectedSlot) return toast.error("Please choose a time slot");

        try {
            const payload = {
                patient_id: Number(patientId),
                department_id: Number(bookDeptId),
                doctor_user_id: Number(bookDoctorId),
                date: bookDate,
                purpose: purpose || "Consultation",
                appointment_type: bookingMode, // free | slot
            };
            if (bookingMode === "slot") payload.slot_start = selectedSlot;

            const { data } = await createAppointment(payload);
            const token = data?.queue_no ? `Token #${data.queue_no}` : "Token created";
            toast.success(`${bookingMode === "free" ? "Free booking" : "Slot booking"} done · ${token}`);

            setSelectedSlot("");
            setPageTab("list");
            setScope(bookDate === today ? "today" : "date");
            setDate(bookDate);
            await loadAppointments();
        } catch {
            // axios interceptor handles toast
        }
    };

    const changeStatus = async (row, nextStatus, options = {}) => {
        const apptId = row?.id;
        if (!apptId) return;

        try {
            const { data } = await updateAppointmentStatus(apptId, nextStatus);
            toast.success(`Status updated to ${String(data?.status || nextStatus).toUpperCase()}`);

            if (options.goToVisit && data?.visit_id) {
                navigate(`/opd/visit/${data.visit_id}`);
                return;
            }
            await loadAppointments();
        } catch { }
    };

    const pageTabs = useMemo(
        () => [
            { key: "list", label: "All Appointments" },
            { key: "book", label: "New Booking" },
        ],
        []
    );

    return (
        <div className={UI.page}>
            <div className={UI.stickyTop}>
                <div className="px-4 py-4 md:px-8">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={UI.chip}>
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Live OPD · Appointments
                                    </span>

                                    <span className={UI.chip}>
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {prettyDate(activeDate)}
                                    </span>

                                    <span className={UI.chip}>
                                        <Filter className="h-3.5 w-3.5" />
                                        Showing <span className="tabular-nums">{filteredList.length}</span>
                                    </span>

                                    {loadingAppts ? (
                                        <span className={UI.chip}>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Loading…
                                        </span>
                                    ) : null}
                                </div>

                                <h1 className="mt-2 text-[18px] md:text-[22px] font-semibold tracking-tight text-slate-900">
                                    OPD Appointments
                                </h1>
                                <p className="mt-1 text-[12px] md:text-[13px] text-slate-600">
                                    All appointments are visible. Use filters for department / doctor / free-slot / status.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                <button
                                    type="button"
                                    onClick={refreshAll}
                                    className={cx(UI.pillBtn, "h-10")}
                                    disabled={loadingAppts || loadingDepts || loadingDoctors || loadingSlots}
                                    title="Refresh"
                                >
                                    <RefreshCcw className={cx("h-4 w-4", (loadingAppts || loadingDepts) && "animate-spin")} />
                                    Refresh
                                </button>

                                <SegmentedTabs
                                    value={pageTab}
                                    onChange={(k) => setPageTab(k)}
                                    tabs={pageTabs}
                                    layoutId="seg-page"
                                />
                            </div>
                        </div>

                        {/* LIST TOOLBAR */}
                        {pageTab === "list" && (
                            <div className="rounded-3xl border border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_10px_28px_rgba(2,6,23,0.06)] px-4 py-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <SegmentedTabs
                                            value={scope}
                                            onChange={(k) => {
                                                setScope(k);
                                                if (k === "today") setDate(today);
                                            }}
                                            tabs={[
                                                { key: "today", label: "Today" },
                                                { key: "date", label: "Schedule Date" },
                                            ]}
                                            layoutId="seg-scope"
                                        />

                                        {scope === "date" && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                                    onClick={() => setDate((d) => addDays(d, -1))}
                                                >
                                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                                    Prev
                                                </Button>

                                                <Input
                                                    type="date"
                                                    value={date}
                                                    onChange={(e) => setDate(e.target.value)}
                                                    className="h-10 rounded-2xl border-black/10 bg-white/90 w-[170px]"
                                                />

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                                    onClick={() => setDate((d) => addDays(d, 1))}
                                                >
                                                    Next
                                                    <ArrowRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="relative w-full sm:w-[320px]">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                value={q}
                                                onChange={(e) => setQ(e.target.value)}
                                                placeholder="Search name / UHID / token / doctor / dept…"
                                                className={cx(UI.input, "pl-10 h-10")}
                                            />
                                        </div>

                                        <Button
                                            type="button"
                                            className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                            onClick={() => setPageTab("book")}
                                        >
                                            <Ticket className="mr-2 h-4 w-4" />
                                            New Booking
                                        </Button>
                                    </div>
                                </div>

                                <Separator className="bg-black/10 my-3" />

                                <div className="grid gap-3 lg:grid-cols-12">
                                    <div className="lg:col-span-3">
                                        <label className="text-[11px] font-semibold text-slate-600">Department</label>
                                        <div className="relative">
                                            {loadingDepts && (
                                                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                                            )}
                                            <select
                                                value={deptFilter}
                                                onChange={(e) => setDeptFilter(e.target.value)}
                                                className={cx(UI.input, "h-10")}
                                                disabled={loadingDepts}
                                            >
                                                <option value="all">{loadingDepts ? "Loading…" : "All departments"}</option>
                                                {(depts || []).map((d) => (
                                                    <option key={d.id} value={String(d.id)}>
                                                        {d.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-3">
                                        <label className="text-[11px] font-semibold text-slate-600">Doctor</label>
                                        <div className="relative">
                                            {loadingDoctors && (
                                                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                                            )}
                                            <select
                                                value={doctorFilter}
                                                onChange={(e) => setDoctorFilter(e.target.value)}
                                                className={cx(UI.input, "h-10")}
                                                disabled={deptFilter === "all" || loadingDoctors}
                                            >
                                                <option value="all">
                                                    {deptFilter === "all"
                                                        ? "Select department first"
                                                        : loadingDoctors
                                                            ? "Loading doctors…"
                                                            : "All doctors (within dept)"}
                                                </option>
                                                {(doctors || []).map((u) => (
                                                    <option key={u.id} value={String(u.id)}>
                                                        {u.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2">
                                        <label className="text-[11px] font-semibold text-slate-600">Mode</label>
                                        <select
                                            value={modeFilter}
                                            onChange={(e) => setModeFilter(e.target.value)}
                                            className={cx(UI.input, "h-10")}
                                        >
                                            <option value="all">All</option>
                                            <option value="free">Free (Token)</option>
                                            <option value="slot">Slot</option>
                                        </select>
                                    </div>

                                    <div className="lg:col-span-4 flex items-end justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                            onClick={() => {
                                                setQ("");
                                                setServerQ("");
                                                setStatus("all");
                                                setModeFilter("all");
                                                setDeptFilter("all");
                                                setDoctorFilter("all");
                                            }}
                                        >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Reset filters
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                            onClick={loadAppointments}
                                            disabled={loadingAppts}
                                        >
                                            <RefreshCcw className={cx("mr-2 h-4 w-4", loadingAppts && "animate-spin")} />
                                            Reload
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                        Status
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-black/10 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700"
                                    >
                                        Showing <span className="ml-1 tabular-nums">{filteredList.length}</span>
                                    </Badge>
                                </div>

                                <div className="mt-2 flex items-center gap-1.5 overflow-auto no-scrollbar py-1">
                                    {statusTabs.map((t) => (
                                        <FilterPill
                                            key={t.key}
                                            label={t.label}
                                            active={status === t.key}
                                            onClick={() => setStatus(t.key)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={UI.container}>
                <AnimatePresence initial={false}>
                    {/* LIST */}
                    {pageTab === "list" && (
                        <motion.div key="list" {...fadeIn} className="space-y-3">
                            <Card className={cx(UI.glass, "overflow-hidden flex flex-col")}>
                                <CardHeader className="border-b border-black/10 bg-white/60 backdrop-blur-xl">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <CardTitle className="text-[15px] font-semibold text-slate-900">
                                                All appointments
                                            </CardTitle>
                                            <CardDescription className="text-[12px] text-slate-600">
                                                Date: <span className="font-semibold">{prettyDate(activeDate)}</span>
                                            </CardDescription>
                                        </div>

                                        <Badge
                                            variant="outline"
                                            className="rounded-full border-black/10 bg-white/85 text-[11px] font-semibold text-slate-700"
                                        >
                                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                                            Premium Cards
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-4 min-h-0">
                                    {loadingAppts && (
                                        <div className="space-y-3">
                                            {[0, 1, 2, 3].map((i) => (
                                                <div key={i} className="rounded-3xl border border-black/10 bg-white/70 px-4 py-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex-1 space-y-2">
                                                            <Skeleton className="h-4 w-48 rounded-xl" />
                                                            <Skeleton className="h-3 w-80 rounded-xl" />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Skeleton className="h-10 w-24 rounded-2xl" />
                                                            <Skeleton className="h-10 w-24 rounded-2xl" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!loadingAppts && filteredList.length === 0 && (
                                        <EmptyState
                                            icon={<Filter className="h-5 w-5 text-slate-700" />}
                                            title="No appointments found"
                                            subtitle="Try changing date or filters."
                                        />
                                    )}

                                    {!loadingAppts && filteredList.length > 0 && (
                                        <ScrollArea className="h-[min(100vh,calc(100dvh-320px))] pr-1">
                                            <div className="space-y-2 pb-2">
                                                {filteredList.map((a) => (
                                                    <ApptCard
                                                        key={a?.id}
                                                        a={a}
                                                        onStatus={changeStatus}
                                                    />
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* BOOK */}
                    {pageTab === "book" && (
                        <motion.div key="book" {...fadeIn} className="space-y-4">
                            <Card className={cx(UI.glass, "overflow-hidden")}>
                                <CardHeader className="border-b border-black/10 bg-white/60 backdrop-blur-xl">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div className="min-w-0">
                                            <CardTitle className="text-[15px] font-semibold text-slate-900">
                                                New appointment booking
                                            </CardTitle>
                                            <CardDescription className="text-[12px] text-slate-600">
                                                Flow: <span className="font-semibold">Patient → Department → Doctor → Free/Slot</span>
                                            </CardDescription>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                                onClick={() => setPageTab("list")}
                                            >
                                                Back to list
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-4 space-y-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={cx(UI.chip, patientId ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "")}>
                                            {patientId ? <Check className="h-3.5 w-3.5" /> : <User2 className="h-3.5 w-3.5" />}
                                            Step 1 · Patient
                                        </span>
                                        <span className={cx(UI.chip, bookDeptId ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "")}>
                                            {bookDeptId ? <Check className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
                                            Step 2 · Department
                                        </span>
                                        <span className={cx(UI.chip, bookDoctorId ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "")}>
                                            {bookDoctorId ? <Check className="h-3.5 w-3.5" /> : <Stethoscope className="h-3.5 w-3.5" />}
                                            Step 3 · Doctor
                                        </span>
                                        <span className={UI.chip}>
                                            <Ticket className="h-3.5 w-3.5" />
                                            Step 4 · {bookingMode === "free" ? "Free (Token)" : "Slot"}
                                        </span>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-slate-600">Appointment Date</label>
                                            <Input
                                                type="date"
                                                value={bookDate}
                                                onChange={(e) => setBookDate(e.target.value)}
                                                className="h-11 rounded-2xl border-black/10 bg-white/90"
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-9 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                                    onClick={() => setBookDate((d) => addDays(d, -1))}
                                                >
                                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                                    Prev
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-9 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                                    onClick={() => setBookDate((d) => addDays(d, 1))}
                                                >
                                                    Next
                                                    <ArrowRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 md:col-span-2">
                                            <label className="text-[11px] font-semibold text-slate-600">Booking Mode</label>
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <SegmentedTabs
                                                    value={bookingMode}
                                                    onChange={(k) => setBookingMode(k)}
                                                    tabs={[
                                                        { key: "free", label: "Free Booking (Token)" },
                                                        { key: "slot", label: "Time Slot Booking" },
                                                    ]}
                                                    layoutId="seg-book-mode"
                                                />
                                                <span className="text-[11px] text-slate-500">
                                                    Default is <span className="font-semibold text-slate-700">Free</span>
                                                </span>
                                            </div>

                                            <div className="space-y-1.5 mt-3">
                                                <label className="text-[11px] font-semibold text-slate-600">Purpose</label>
                                                <Input
                                                    value={purpose}
                                                    onChange={(e) => setPurpose(e.target.value)}
                                                    placeholder="Consultation / Review / Procedure…"
                                                    className="h-11 rounded-2xl border-black/10 bg-white/90"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 1: Patient */}
                                    <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[13px] font-semibold text-slate-900">Step 1 · Select patient</div>
                                                <div className="text-[11px] text-slate-500">Pick patient first (mandatory)</div>
                                            </div>
                                            {patientSummary ? (
                                                <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700">
                                                    <User2 className="h-3.5 w-3.5" />
                                                    {patientSummary.nm}
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="mt-3">
                                            <PatientPicker value={patientId} onChange={handlePatientChange} />
                                        </div>

                                        {patientSummary && (
                                            <div className="mt-3 rounded-3xl border border-black/10 bg-white/80 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-[13px] font-semibold text-slate-900 truncate">
                                                            {patientSummary.nm}
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                                                            {patientSummary.uhid ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-2.5 py-1">
                                                                    <Hash className="h-3.5 w-3.5 text-slate-500" />
                                                                    UHID <span className="font-semibold text-slate-800">{patientSummary.uhid}</span>
                                                                </span>
                                                            ) : null}
                                                            {patientSummary.age || patientSummary.sex ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-2.5 py-1">
                                                                    <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                                                                    <span className="font-semibold text-slate-800">
                                                                        {patientSummary.age ? `${patientSummary.age}y` : ""}
                                                                        {patientSummary.age && patientSummary.sex ? " · " : ""}
                                                                        {patientSummary.sex || ""}
                                                                    </span>
                                                                </span>
                                                            ) : null}
                                                            {patientSummary.phone ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-2.5 py-1">
                                                                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                                                                    <span className="font-semibold text-slate-800">{patientSummary.phone}</span>
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="h-11 w-11 rounded-3xl border border-black/10 bg-black/[0.03] grid place-items-center text-[12px] font-semibold text-slate-800">
                                                        {initialsFromName(patientSummary.nm)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Step 2+3: DoctorPicker (YOUR reusable component) */}
                                    <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-4">
                                        <div className="text-[13px] font-semibold text-slate-900 mb-2">
                                            Step 2 & 3 · Department and Doctor
                                        </div>

                                        <DoctorPicker
                                            value={bookDoctorId}
                                            label="OPD Booking — Department · Doctor"
                                            onChange={(docId, meta) => {
                                                setBookDoctorId(docId ? Number(docId) : null);
                                                setBookDeptId(meta?.department_id ? Number(meta.department_id) : null);
                                            }}
                                        />

                                        <div className="mt-2 text-[11px] text-slate-500">
                                            Selected Dept ID: <span className="font-semibold text-slate-800">{bookDeptId || "—"}</span> ·
                                            Selected Doctor ID: <span className="font-semibold text-slate-800">{bookDoctorId || "—"}</span>
                                        </div>
                                    </div>

                                    {/* Step 4: Slots */}
                                    {bookingMode === "slot" && (
                                        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-4">
                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <div className="text-[13px] font-semibold text-slate-900">
                                                        Step 4 · Select time slot
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {bookDoctorId ? `${freeSlots.length} free slot(s) available` : "Pick doctor first"}
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setShowAllSlots((v) => !v)}
                                                    className={cx(UI.pillBtn, "h-9")}
                                                    disabled={!bookDoctorId}
                                                >
                                                    {showAllSlots ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                                    {showAllSlots ? "All slots" : "Free only"}
                                                </button>
                                            </div>

                                            <div className="mt-3">
                                                {!bookDoctorId ? (
                                                    <EmptyState title="Pick a doctor first" subtitle="Then slots will load instantly." icon={<Clock className="h-5 w-5 text-slate-700" />} />
                                                ) : loadingSlots ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {Array.from({ length: 12 }).map((_, i) => (
                                                            <Skeleton key={i} className="h-9 w-24 rounded-full bg-slate-100" />
                                                        ))}
                                                    </div>
                                                ) : visibleSlots.length === 0 ? (
                                                    <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
                                                        No slots available. Try another date/doctor.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {["Morning", "Afternoon", "Evening"].map((bucket) => {
                                                            const list = slotsByBucket[bucket] || [];
                                                            if (!list.length) return null;

                                                            return (
                                                                <div key={bucket} className="space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                                                            {bucket}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-wrap gap-2">
                                                                        {list.map((s, idx) => {
                                                                            const st = slotStart(s);
                                                                            const en = slotEnd(s);
                                                                            const appt = apptByStart.get(st);
                                                                            const free = isFreeSlot(s) && !appt;
                                                                            const selected = selectedSlot === st;

                                                                            return (
                                                                                <button
                                                                                    key={`${bucket}-${st}-${idx}`}
                                                                                    type="button"
                                                                                    disabled={!free}
                                                                                    onClick={() => free && setSelectedSlot(st)}
                                                                                    className={cx(
                                                                                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold transition",
                                                                                        free
                                                                                            ? selected
                                                                                                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                                                                                : "border-black/10 bg-white/85 text-slate-700 hover:bg-black/[0.03]"
                                                                                            : "border-black/10 bg-slate-100 text-slate-500 cursor-not-allowed opacity-80"
                                                                                    )}
                                                                                >
                                                                                    <Clock className={cx("h-4 w-4", selected ? "text-white" : "text-slate-500")} />
                                                                                    <span className="tabular-nums">
                                                                                        {st}{en ? `–${en}` : ""}
                                                                                    </span>

                                                                                    {!free && appt ? (
                                                                                        <span className="ml-1">
                                                                                            <StatusPill status={String(appt.status || "booked").toLowerCase()} />
                                                                                        </span>
                                                                                    ) : null}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Final CTA */}
                                    <form onSubmit={book} className="rounded-3xl border border-black/10 bg-white/80 p-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-semibold text-slate-900">Booking preview</div>
                                                <div className="mt-1 text-[11px] text-slate-600">
                                                    {patientSummary ? patientSummary.nm : "Select patient"} ·{" "}
                                                    {bookDeptId ? `Dept #${bookDeptId}` : "Select department"} ·{" "}
                                                    {bookDoctorId ? `Doctor #${bookDoctorId}` : "Select doctor"} ·{" "}
                                                    <span className="font-semibold text-slate-800">{prettyDate(bookDate)}</span>{" "}
                                                    · <span className="font-semibold text-slate-800">
                                                        {bookingMode === "free" ? "Free (Token)" : selectedSlot ? `Slot ${selectedSlot}` : "Select slot"}
                                                    </span>
                                                </div>
                                            </div>

                                            <Button
                                                type="submit"
                                                className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6"
                                                disabled={!canBookNow}
                                            >
                                                {bookingMode === "free" ? <Ticket className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                {bookingMode === "free" ? "Book (Token)" : "Book (Slot)"}
                                            </Button>
                                        </div>

                                        {!canBookNow && (
                                            <div className="mt-2 text-[11px] text-slate-500">
                                                Required: patient + department + doctor
                                                {bookingMode === "slot" ? " + slot" : ""}.
                                            </div>
                                        )}
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
