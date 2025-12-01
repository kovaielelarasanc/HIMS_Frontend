// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchDashboardData } from "../api/dashboard";

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/components/ui/tabs";

import {
    Calendar,
    RefreshCcw,
    AlertCircle,
    BarChart3,
    Activity,
    Stethoscope,
    BedDouble,
    Pill,
    FlaskConical,
    ScanLine,
    IndianRupee,
    Clock3,
} from "lucide-react";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";

import { cn } from "@/lib/utils";

const chartColors = ["#0f172a", "#0284c7", "#22c55e", "#e11d48", "#6366f1"];

function formatDateInput(d) {
    return d.toISOString().slice(0, 10);
}

function addDays(base, delta) {
    const d = new Date(base);
    d.setDate(d.getDate() + delta);
    return d;
}

// Animation variants
const pageVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: "easeOut" },
    },
};

const metricsContainerVariants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.05,
        },
    },
};

const metricItemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.97 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.25, ease: "easeOut" },
    },
};

const blockVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.25, ease: "easeOut" },
    },
};

export default function Dashboard() {
    const today = new Date();
    const [dateFrom, setDateFrom] = useState(() => formatDateInput(today));
    const [dateTo, setDateTo] = useState(() => formatDateInput(today));
    const [activePreset, setActivePreset] = useState("today");
    const [activeTab, setActiveTab] = useState("overview");

    const [data, setData] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const datesValid = Boolean(dateFrom && dateTo);

    useEffect(() => {
        if (!datesValid) {
            setIsLoading(false);
            setError("");
            setData(null);
            return;
        }

        const load = async () => {
            setIsLoading(true);
            setError("");
            try {
                const params = { date_from: dateFrom, date_to: dateTo };
                const res = await fetchDashboardData(params);
                console.log("DASHBOARD DATA >>>", res.data);
                setData(res.data);
                setLastUpdated(new Date());
            } catch (err) {
                console.error(err);
                setError(
                    err?.response?.data?.detail ||
                    "Failed to load dashboard data. Please try again."
                );
                setData(null);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [dateFrom, dateTo, refreshKey, datesValid]);

    // const roleLabel = useMemo(() => {
    //     if (!data?.role) return "Dashboard";
    //     const r = data.role.toLowerCase();
    //     switch (r) {
    //         case "admin":
    //             return "Admin Dashboard";
    //         case "doctor":
    //             return "Doctor Dashboard";
    //         case "nurse":
    //             return "Nurse / IPD Dashboard";
    //         case "reception":
    //             return "Reception Dashboard";
    //         case "lab":
    //             return "Laboratory Dashboard";
    //         case "radiology":
    //             return "Radiology Dashboard";
    //         case "pharmacy":
    //             return "Pharmacy Dashboard";
    //         case "billing":
    //             return "Billing Dashboard";
    //         default:
    //             return "Dashboard";
    //     }
    // }, [data?.role]);

    // Permission capabilities from backend
    const caps = data?.filters?.caps || {};
    const hasCaps = Object.keys(caps).length > 0;

    const capabilityChips = useMemo(() => {
        if (!hasCaps) return [];
        const chips = [];

        if (caps.can_patients) {
            chips.push({
                key: "patients",
                label: "Patients",
                icon: Activity,
            });
        }
        if (caps.can_opd) {
            chips.push({
                key: "opd",
                label: "OPD",
                icon: Stethoscope,
            });
        }
        if (caps.can_ipd) {
            chips.push({
                key: "ipd",
                label: "IPD / Beds",
                icon: BedDouble,
            });
        }
        if (caps.can_lab) {
            chips.push({
                key: "lab",
                label: "Lab",
                icon: FlaskConical,
            });
        }
        if (caps.can_radiology) {
            chips.push({
                key: "radiology",
                label: "Radiology",
                icon: ScanLine,
            });
        }
        if (caps.can_pharmacy) {
            chips.push({
                key: "pharmacy",
                label: "Pharmacy",
                icon: Pill,
            });
        }
        if (caps.can_billing) {
            chips.push({
                key: "billing",
                label: "Billing",
                icon: IndianRupee,
            });
        }
        if (caps.can_ot) {
            chips.push({
                key: "ot",
                label: "OT",
                icon: Activity,
            });
        }

        return chips;
    }, [hasCaps, caps]);

    // Widgets
    const metricWidgets = useMemo(
        () => data?.widgets?.filter((w) => w.widget_type === "metric") || [],
        [data]
    );
    const tableWidgets = useMemo(
        () => data?.widgets?.filter((w) => w.widget_type === "table") || [],
        [data]
    );
    const chartWidgets = useMemo(
        () => data?.widgets?.filter((w) => w.widget_type === "chart") || [],
        [data]
    );

    const patientFlowWidget = chartWidgets.find(
        (w) => w.code === "patient_flow"
    );
    const bedOccWidget = chartWidgets.find(
        (w) => w.code === "ipd_bed_occupancy"
    );
    const revenueStreamWidget = chartWidgets.find(
        (w) => w.code === "revenue_by_stream"
    );
    const apptStatusWidget = chartWidgets.find(
        (w) => w.code === "appointment_status"
    );
    const ipdStatusWidget = chartWidgets.find(
        (w) => w.code === "ipd_status"
    );
    const paymentModeWidget = chartWidgets.find(
        (w) => w.code === "payment_modes"
    );
    const topLabTestsWidget = chartWidgets.find(
        (w) => w.code === "top_lab_tests"
    );
    const topRadiologyTestsWidget = chartWidgets.find(
        (w) => w.code === "top_radiology_tests"
    );
    const billingSummaryWidget = chartWidgets.find(
        (w) => w.code === "billing_summary"
    );

    const topMedicinesWidget = chartWidgets.find(
        (w) => w.code === "top_medicines"
    );
    const recentAdmissionsWidget = tableWidgets.find(
        (w) => w.code === "recent_ipd_admissions"
    );

    const revenueMetricWidgets = metricWidgets.filter((w) =>
        w.code.startsWith("revenue_")
    );
    const nonRevenueMetricWidgets = metricWidgets.filter(
        (w) => !w.code.startsWith("revenue_")
    );

    const handleRefresh = () => setRefreshKey((k) => k + 1);

    const handlePresetChange = (preset) => {
        setActivePreset(preset);
        const base = new Date();
        if (preset === "today") {
            const d = formatDateInput(base);
            setDateFrom(d);
            setDateTo(d);
        } else if (preset === "7d") {
            const from = formatDateInput(addDays(base, -6));
            const to = formatDateInput(base);
            setDateFrom(from);
            setDateTo(to);
        } else if (preset === "30d") {
            const from = formatDateInput(addDays(base, -29));
            const to = formatDateInput(base);
            setDateFrom(from);
            setDateTo(to);
        } else if (preset === "month") {
            const first = new Date(base.getFullYear(), base.getMonth(), 1);
            const from = formatDateInput(first);
            const to = formatDateInput(base);
            setDateFrom(from);
            setDateTo(to);
        } else {
            // custom – just mark preset
        }
    };

    const handleDateChange = (setter) => (e) => {
        setActivePreset("custom");
        setter(e.target.value);
    };

    // Permission-aware quick pills
    const quickPills = useMemo(() => {
        if (!data) return [];

        const findMetric = (code) =>
            metricWidgets.find((w) => w.code === code)?.data ?? 0;

        const newPatients = Number(findMetric("metric_new_patients")) || 0;
        const opdVisits = Number(findMetric("metric_opd_visits")) || 0;
        const ipdAdmissions =
            Number(findMetric("metric_ipd_admissions")) || 0;

        const bedData = bedOccWidget?.data || {};
        const occupancyPct = bedData.occupancy_pct ?? 0;

        const streams = revenueStreamWidget?.data || [];
        const topStream =
            Array.isArray(streams) && streams.length
                ? [...streams].sort((a, b) => (b.value || 0) - (a.value || 0))[0]
                : null;

        const pills = [];

        if (caps.can_patients && metricWidgets.length) {
            pills.push({
                key: "patients",
                label: "New Patients",
                value: newPatients,
                helper: "Registered in period",
                icon: Activity,
                tone: "sky",
            });
        }
        if (caps.can_opd && metricWidgets.length) {
            pills.push({
                key: "opd",
                label: "OPD Visits",
                value: opdVisits,
                helper: "Completed consults",
                icon: Stethoscope,
                tone: "emerald",
            });
        }
        if (caps.can_ipd && metricWidgets.length) {
            pills.push({
                key: "ipd",
                label: "IPD Admissions",
                value: ipdAdmissions,
                helper: "Admitted cases",
                icon: BedDouble,
                tone: "violet",
            });
        }
        if (caps.can_ipd && bedOccWidget) {
            pills.push({
                key: "beds",
                label: "Bed Occupancy",
                value: occupancyPct,
                suffix: "%",
                helper: "Across all wards",
                icon: BedDouble,
                tone: "amber",
            });
        }
        if (topStream && (caps.can_billing || caps.can_pharmacy || caps.can_lab || caps.can_radiology)) {
            pills.push({
                key: "revenue",
                label: "Top Revenue Stream",
                value: topStream.value || 0,
                helper: topStream.label || "—",
                icon:
                    topStream.label === "Pharmacy"
                        ? Pill
                        : topStream.label === "Lab"
                            ? FlaskConical
                            : topStream.label === "Radiology"
                                ? ScanLine
                                : IndianRupee,
                tone: "rose",
            });
        }

        return pills.filter(Boolean);
    }, [
        data,
        metricWidgets,
        bedOccWidget,
        revenueStreamWidget,
        caps.can_patients,
        caps.can_opd,
        caps.can_ipd,
        caps.can_billing,
        caps.can_pharmacy,
        caps.can_lab,
        caps.can_radiology,
    ]);

    // Determine which tabs should be visible based on perms
    const visibleTabs = useMemo(() => {
        const list = [
            { key: "overview", label: "Overview", show: true },
            {
                key: "clinical",
                label: "Clinical",
                show: caps.can_patients || caps.can_opd || caps.can_ipd,
            },
            {
                key: "revenue",
                label: "Revenue",
                show:
                    caps.can_billing ||
                    caps.can_pharmacy ||
                    caps.can_lab ||
                    caps.can_radiology,
            },
            {
                key: "operations",
                label: "Operations",
                show:
                    caps.can_ipd ||
                    caps.can_pharmacy ||
                    caps.can_lab ||
                    caps.can_radiology,
            },
        ];
        return list.filter((t) => t.show);
    }, [caps]);

    // Ensure activeTab is always one of visible tabs
    useEffect(() => {
        if (!visibleTabs.find((t) => t.key === activeTab)) {
            if (visibleTabs.length > 0) {
                setActiveTab(visibleTabs[0].key);
            }
        }
    }, [visibleTabs, activeTab]);

    return (
        <motion.div
            className="relative min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-3 md:px-6 md:py-6 rounded"
            variants={pageVariants}
            initial="hidden"
            animate="visible"
        >
            {/* background accents */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -top-24 right-0 h-40 w-40 rounded-full bg-sky-200/40 blur-3xl" />
                <div className="absolute -bottom-24 left-4 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" />
            </div>

            <div className="mx-auto w-full max-w-6xl space-y-4">
                {/* HEADER + FILTER BAR */}
                <div className="space-y-3">
                    <motion.div
                        className={cn(
                            "flex flex-col md:flex-row md:items-start md:justify-between gap-3",
                            "rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm p-3 md:p-5 shadow-sm"
                        )}
                    >
                        <div className="space-y-2 md:max-w-md">
                            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] md:text-[11px] font-medium text-sky-700">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                </span>
                                Live operations & clinical overview
                            </div>
                            <h1 className="text-xl md:text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600 border border-sky-200">
                                    <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
                                </span>
                                {/* {roleLabel} */}Dashboard
                            </h1>
                            <p className="text-xs md:text-sm text-slate-600">
                                Monitor patients, beds, diagnostics, pharmacy and revenue in one
                                live dashboard designed for hospital admins & clinical teams.
                            </p>

                            {/* Permission capability chips */}
                            {hasCaps && capabilityChips.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {capabilityChips.map((chip) => (
                                        <span
                                            key={chip.key}
                                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700"
                                        >
                                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-inner">
                                                <chip.icon className="w-3 h-3" />
                                            </span>
                                            <span className="font-medium">{chip.label}</span>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {lastUpdated && (
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 mt-1 text-[10px] text-slate-600">
                                    <Clock3 className="w-3 h-3" />
                                    <span className="font-medium">Last updated:</span>
                                    <span>
                                        {lastUpdated.toLocaleTimeString("en-IN", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                            {/* Date presets */}
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { key: "today", label: "Today" },
                                    { key: "7d", label: "Last 7 days" },
                                    { key: "30d", label: "Last 30 days" },
                                    { key: "month", label: "This month" },
                                    { key: "custom", label: "Custom" },
                                ].map((p) => (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => handlePresetChange(p.key)}
                                        className={cn(
                                            "px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors",
                                            activePreset === p.key
                                                ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                        )}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            {/* Date range + refresh */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-inner">
                                    <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                                    <div className="flex flex-col gap-1 w-full text-[11px] text-slate-700 sm:flex-row sm:items-center">
                                        <div className="flex items-center gap-1 w-full">
                                            <span className="hidden sm:inline">From</span>
                                            <input
                                                type="date"
                                                value={dateFrom}
                                                onChange={handleDateChange(setDateFrom)}
                                                className="w-full border border-slate-200 bg-slate-50 rounded px-1.5 py-0.5 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 w-full">
                                            <span className="hidden sm:inline">To</span>
                                            <input
                                                type="date"
                                                value={dateTo}
                                                onChange={handleDateChange(setDateTo)}
                                                className="w-full border border-slate-200 bg-slate-50 rounded px-1.5 py-0.5 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <motion.button
                                    onClick={handleRefresh}
                                    whileTap={{ scale: 0.96 }}
                                    className={cn(
                                        "inline-flex items-center justify-center gap-2 rounded-xl",
                                        "border border-sky-600 bg-sky-600 text-white shadow-sm",
                                        "px-3 py-2 text-xs sm:text-sm font-medium w-full sm:w-auto",
                                        "hover:bg-sky-500 hover:border-sky-500 transition-colors"
                                    )}
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                    Refresh
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>

                    {/* ERROR */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                            >
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4 mt-0.5" />
                                    <div>
                                        <AlertTitle>Dashboard error</AlertTitle>
                                        <AlertDescription>{error}</AlertDescription>
                                    </div>
                                </Alert>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* AT A GLANCE STRIP */}
                    {!isLoading && data && quickPills.length > 0 && (
                        <motion.div
                            className="rounded-2xl border border-slate-200 bg-white px-2.5 py-3 shadow-sm"
                            variants={blockVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <div className="flex items-center gap-3 mb-2 px-1">
                                <h2 className="text-xs font-semibold text-slate-700">
                                    At a glance
                                </h2>
                                <span className="h-px flex-1 bg-slate-200" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {quickPills.map((pill) => (
                                    <QuickPill key={pill.key} pill={pill} />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* NO DATE SELECTED */}
                {!datesValid && !isLoading && !error && (
                    <Card className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70">
                        <CardContent className="py-6 flex flex-col items-center text-center gap-2">
                            <Calendar className="w-8 h-8 text-slate-400 mb-1" />
                            <p className="text-sm font-medium text-slate-700">
                                Select a date range to see live dashboard data.
                            </p>
                            <p className="text-xs text-slate-500 max-w-xs">
                                Choose both <span className="font-semibold">From</span> and{" "}
                                <span className="font-semibold">To</span> dates above. We’ll
                                show patient, revenue, pharmacy and diagnostics insights.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* LOADING */}
                {isLoading && datesValid && !data && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <Skeleton className="h-20 rounded-2xl" />
                            <Skeleton className="h-20 rounded-2xl" />
                            <Skeleton className="h-20 rounded-2xl" />
                            <Skeleton className="h-20 rounded-2xl" />
                        </div>
                        <Skeleton className="h-56 rounded-2xl" />
                        <Skeleton className="h-56 rounded-2xl" />
                    </div>
                )}

                {/* MAIN CONTENT */}
                {!isLoading && datesValid && data && (
                    <motion.div
                        variants={blockVariants}
                        initial="hidden"
                        animate="visible"
                        className="pb-4"
                    >
                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="w-full"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <TabsList className="flex flex-nowrap overflow-x-auto gap-1 rounded-full bg-slate-100/80 p-1">
                                    {visibleTabs.map((tab) => (
                                        <TabsTrigger
                                            key={tab.key}
                                            value={tab.key}
                                            className="px-3 py-1.5 text-xs sm:text-sm rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
                                        >
                                            {tab.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </div>

                            {/* OVERVIEW TAB */}
                            <TabsContent value="overview" className="space-y-4 mt-2">
                                {metricWidgets.length > 0 && (
                                    <section className="space-y-2">
                                        <h2 className="text-sm font-semibold text-slate-700">
                                            Key metrics
                                        </h2>
                                        <motion.div
                                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
                                            variants={metricsContainerVariants}
                                            initial="hidden"
                                            animate="visible"
                                        >
                                            {metricWidgets.map((w) => (
                                                <motion.div
                                                    key={w.code}
                                                    variants={metricItemVariants}
                                                    whileHover={{
                                                        y: -2,
                                                        scale: 1.01,
                                                        boxShadow:
                                                            "0 18px 35px rgba(15, 23, 42, 0.12)",
                                                    }}
                                                    transition={{
                                                        type: "spring",
                                                        stiffness: 220,
                                                        damping: 20,
                                                    }}
                                                >
                                                    <MetricWidgetCard widget={w} />
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    </section>
                                )}

                                <section className="space-y-2">
                                    <h2 className="text-sm font-semibold text-slate-700">
                                        Activity & revenue mix
                                    </h2>
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                                        {patientFlowWidget && (
                                            <ChartWidgetCard widget={patientFlowWidget} />
                                        )}
                                        {revenueStreamWidget && (
                                            <ChartWidgetCard widget={revenueStreamWidget} />
                                        )}
                                    </div>
                                </section>
                            </TabsContent>

                            {/* CLINICAL TAB */}
                            <TabsContent value="clinical" className="space-y-4 mt-2">
                                {nonRevenueMetricWidgets.length > 0 && (
                                    <section className="space-y-2">
                                        <h2 className="text-sm font-semibold text-slate-700">
                                            Clinical metrics
                                        </h2>
                                        <motion.div
                                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
                                            variants={metricsContainerVariants}
                                            initial="hidden"
                                            animate="visible"
                                        >
                                            {nonRevenueMetricWidgets.map((w) => (
                                                <motion.div
                                                    key={w.code}
                                                    variants={metricItemVariants}
                                                    whileHover={{
                                                        y: -2,
                                                        scale: 1.01,
                                                        boxShadow:
                                                            "0 18px 35px rgba(15, 23, 42, 0.12)",
                                                    }}
                                                    transition={{
                                                        type: "spring",
                                                        stiffness: 220,
                                                        damping: 20,
                                                    }}
                                                >
                                                    <MetricWidgetCard widget={w} />
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    </section>
                                )}

                                <section className="space-y-2">
                                    <h2 className="text-sm font-semibold text-slate-700">
                                        Patient flow & statuses
                                    </h2>
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                                        {patientFlowWidget && (
                                            <ChartWidgetCard widget={patientFlowWidget} />
                                        )}
                                        {apptStatusWidget && (
                                            <ChartWidgetCard widget={apptStatusWidget} />
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-2">
                                    <h2 className="text-sm font-semibold text-slate-700">
                                        IPD beds & admissions
                                    </h2>
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                                        {bedOccWidget && (
                                            <ChartWidgetCard widget={bedOccWidget} />
                                        )}
                                        {ipdStatusWidget && (
                                            <ChartWidgetCard widget={ipdStatusWidget} />
                                        )}
                                    </div>
                                </section>

                                {recentAdmissionsWidget && (
                                    <section className="space-y-2">
                                        <h2 className="text-sm font-semibold text-slate-700">
                                            Recent IPD admissions
                                        </h2>
                                        <ListWidgetCard widget={recentAdmissionsWidget} />
                                    </section>
                                )}
                            </TabsContent>

                            {/* REVENUE TAB */}
                            <TabsContent value="revenue" className="space-y-4 mt-2">
                                {revenueMetricWidgets.length > 0 && (
                                    <section className="space-y-2">
                                        <h2 className="text-sm font-semibold text-slate-700">
                                            Revenue KPIs
                                        </h2>
                                        <motion.div
                                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
                                            variants={metricsContainerVariants}
                                            initial="hidden"
                                            animate="visible"
                                        >
                                            {revenueMetricWidgets.map((w) => (
                                                <motion.div
                                                    key={w.code}
                                                    variants={metricItemVariants}
                                                    whileHover={{
                                                        y: -2,
                                                        scale: 1.01,
                                                        boxShadow:
                                                            "0 18px 35px rgba(15, 23, 42, 0.12)",
                                                    }}
                                                    transition={{
                                                        type: "spring",
                                                        stiffness: 220,
                                                        damping: 20,
                                                    }}
                                                >
                                                    <MetricWidgetCard widget={w} />
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    </section>
                                )}

                                <section className="space-y-2">
                                    <h2 className="text-sm font-semibold text-slate-700">
                                        Revenue & payment mix
                                    </h2>
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                                        {revenueStreamWidget && (
                                            <ChartWidgetCard widget={revenueStreamWidget} />
                                        )}
                                        {paymentModeWidget && (
                                            <ChartWidgetCard widget={paymentModeWidget} />
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-2">
                                    <h2 className="text-sm font-semibold text-slate-700">
                                        Billed vs pending & top tests
                                    </h2>
                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-4">
                                        {billingSummaryWidget && (
                                            <ChartWidgetCard widget={billingSummaryWidget} />
                                        )}
                                        {topLabTestsWidget && (
                                            <ChartWidgetCard widget={topLabTestsWidget} />
                                        )}
                                        {topRadiologyTestsWidget && (
                                            <ChartWidgetCard widget={topRadiologyTestsWidget} />
                                        )}
                                    </div>
                                </section>

                                {topMedicinesWidget && (
                                    <section className="space-y-2">
                                        <h2 className="text-sm font-semibold text-slate-700">
                                            Top 10 medicines (by quantity)
                                        </h2>
                                        <ChartWidgetCard widget={topMedicinesWidget} />
                                    </section>
                                )}
                            </TabsContent>

                            {/* OPERATIONS TAB */}
                            <TabsContent value="operations" className="space-y-4 mt-2">
                                <section className="space-y-2">
                                    <h2 className="text-sm font-semibold text-slate-700">
                                        Capacity & utilization
                                    </h2>
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                                        {bedOccWidget && (
                                            <ChartWidgetCard widget={bedOccWidget} />
                                        )}
                                        {patientFlowWidget && (
                                            <ChartWidgetCard widget={patientFlowWidget} />
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-2">
                                    <h2 className="text-sm font-semibold text-slate-700">
                                        Pharmacy & diagnostics focus
                                    </h2>
                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-4">
                                        {topMedicinesWidget && (
                                            <ChartWidgetCard widget={topMedicinesWidget} />
                                        )}
                                        {topLabTestsWidget && (
                                            <ChartWidgetCard widget={topLabTestsWidget} />
                                        )}
                                        {topRadiologyTestsWidget && (
                                            <ChartWidgetCard widget={topRadiologyTestsWidget} />
                                        )}
                                    </div>
                                </section>

                                {recentAdmissionsWidget && (
                                    <section className="space-y-2">
                                        <h2 className="text-sm font-semibold text-slate-700">
                                            Latest IPD activity
                                        </h2>
                                        <ListWidgetCard widget={recentAdmissionsWidget} />
                                    </section>
                                )}
                            </TabsContent>
                        </Tabs>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

/* ---------- QUICK PILL ---------- */

function QuickPill({ pill }) {
    const { label, value, helper, icon: Icon, tone, suffix } = pill;
    const toneClasses = {
        sky: "bg-sky-50 border-sky-100 text-sky-800",
        emerald: "bg-emerald-50 border-emerald-100 text-emerald-800",
        violet: "bg-violet-50 border-violet-100 text-violet-800",
        amber: "bg-amber-50 border-amber-100 text-amber-800",
        rose: "bg-rose-50 border-rose-100 text-rose-800",
    }[tone || "sky"];

    return (
        <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className={cn(
                "flex-1 min-w-[140px] sm:min-w-[160px] rounded-2xl border px-2.5 py-2",
                "flex items-center gap-2 sm:gap-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]",
                toneClasses
            )}
        >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 text-slate-700 shadow-sm shrink-0">
                {Icon && <Icon className="w-4 h-4" />}
            </div>
            <div className="space-y-0.5">
                <div className="text-[10px] uppercase tracking-wide font-semibold opacity-90">
                    {label}
                </div>
                <div className="text-base sm:text-lg font-semibold leading-tight">
                    {typeof value === "number"
                        ? value.toLocaleString("en-IN", {
                            maximumFractionDigits: suffix === "%" ? 1 : 0,
                        })
                        : value}
                    {suffix && <span className="ml-0.5 text-[10px]">{suffix}</span>}
                </div>
                {helper && (
                    <div className="text-[10px] leading-tight opacity-80">
                        {helper}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

/* ---------- METRIC CARD ---------- */

function MetricWidgetCard({ widget }) {
    const raw = widget.data;
    const value =
        typeof raw === "number"
            ? raw
            : typeof raw === "string"
                ? raw
                : typeof raw === "object" && raw !== null
                    ? raw.value ?? raw.total ?? raw.amount ?? 0
                    : 0;

    const display =
        typeof value === "number"
            ? value.toLocaleString("en-IN", {
                maximumFractionDigits: widget.code.includes("revenue") ? 0 : 0,
            })
            : value;

    return (
        <Card
            className={cn(
                "rounded-2xl shadow-sm overflow-hidden border border-slate-200 bg-white",
                "hover:border-sky-200 transition-colors"
            )}
        >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1">
                <CardTitle className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.35)]" />
                    {widget.title}
                </CardTitle>
                <Badge
                    variant="outline"
                    className="text-[9px] uppercase tracking-wide border-slate-200 text-slate-500"
                >
                    {widget.code}
                </Badge>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="text-2xl md:text-3xl font-semibold tracking-tight mt-1 text-slate-900">
                    {display}
                </div>
                {widget.description && (
                    <p className="text-[11px] text-slate-500 mt-1">
                        {widget.description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

/* ---------- CHART CARD ---------- */

function ChartWidgetCard({ widget }) {
    const chartType = widget.config?.chart_type || "bar";

    // Donut = IPD beds
    if (chartType === "donut") {
        const d = widget.data || {};
        const data = [
            { label: "Occupied", value: d.occupied || 0 },
            { label: "Available", value: d.available || 0 },
        ];
        return (
            <Card className="rounded-2xl shadow-sm border border-slate-200 bg-white">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800">
                        {widget.title}
                    </CardTitle>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        Snapshot
                    </span>
                </CardHeader>
                <CardContent className="h-56 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                dataKey="value"
                                data={data}
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={3}
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={chartColors[index % chartColors.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 8,
                                    fontSize: 12,
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {typeof d.occupancy_pct === "number" && (
                        <p className="text-xs text-slate-600 text-center mt-2">
                            Occupancy:{" "}
                            <span className="font-medium text-emerald-600">
                                {d.occupancy_pct}%
                            </span>{" "}
                            <span className="opacity-80">
                                ({d.occupied}/{d.total} beds)
                            </span>
                        </p>
                    )}
                </CardContent>
            </Card>
        );
    }

    // Pie = status / payment mode
    if (chartType === "pie") {
        const data = Array.isArray(widget.data) ? widget.data : [];
        return (
            <Card className="rounded-2xl shadow-sm border border-slate-200 bg-white">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800">
                        {widget.title}
                    </CardTitle>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        Distribution
                    </span>
                </CardHeader>
                <CardContent className="h-56 sm:h-64">
                    {data.length === 0 ? (
                        <p className="text-sm text-slate-500 mt-4">No data to display.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    dataKey="value"
                                    nameKey="label"
                                    outerRadius={80}
                                    paddingAngle={3}
                                    labelLine={false}
                                    label={(entry) =>
                                        `${entry.label}: ${entry.value ?? 0}`
                                    }
                                >
                                    {data.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={chartColors[index % chartColors.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#ffffff",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: 8,
                                        fontSize: 12,
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>
        );
    }

    // multi_bar = patient flow
    if (chartType === "multi_bar") {
        const data = Array.isArray(widget.data) ? widget.data : [];
        const series = widget.config?.series || [];
        const xKey = widget.config?.x_key || "label";

        return (
            <Card className="rounded-2xl shadow-sm border border-slate-200 bg-white">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-800">
                        {widget.title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-56 sm:h-64">
                    {data.length === 0 ? (
                        <p className="text-sm text-slate-500 mt-4">
                            No data to display.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data}
                                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                            >
                                <XAxis dataKey={xKey} stroke="#6b7280" fontSize={11} />
                                <YAxis stroke="#6b7280" fontSize={11} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#ffffff",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: 8,
                                        fontSize: 12,
                                    }}
                                />
                                {series.map((s, idx) => (
                                    <Bar
                                        key={s.key}
                                        dataKey={s.key}
                                        name={s.label}
                                        radius={[4, 4, 0, 0]}
                                    >
                                        {data.map((_, i) => (
                                            <Cell
                                                key={`cell-${s.key}-${i}`}
                                                fill={chartColors[(idx + i) % chartColors.length]}
                                            />
                                        ))}
                                    </Bar>
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>
        );
    }

    // default bar (e.g. revenue_by_stream, top tests, top meds)
    const data = Array.isArray(widget.data) ? widget.data : [];
    const normalized =
        data.length > 0
            ? data.map((r, i) => ({
                label: r.label ?? r.name ?? `Item ${i + 1}`,
                value: r.value ?? r.amount ?? 0,
            }))
            : [];

    return (
        <Card className="rounded-2xl shadow-sm border border-slate-200 bg-white">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-800">
                    {widget.title}
                </CardTitle>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    {widget.description ? "Insight" : "Summary"}
                </span>
            </CardHeader>
            <CardContent className="h-56 sm:h-64">
                {normalized.length === 0 ? (
                    <p className="text-sm text-slate-500 mt-4">
                        No data to display.
                    </p>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={normalized}
                            margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                        >
                            <XAxis dataKey="label" stroke="#6b7280" fontSize={11} />
                            <YAxis stroke="#6b7280" fontSize={11} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 8,
                                    fontSize: 12,
                                }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {normalized.map((_, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={chartColors[index % chartColors.length]}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

/* ---------- LIST (CARD) WIDGET ---------- */

function ListWidgetCard({ widget }) {
    const rows = Array.isArray(widget.data) ? widget.data : [];
    const columns =
        widget.config?.columns || (rows[0] ? Object.keys(rows[0]) : []);

    return (
        <Card className="rounded-2xl shadow-sm border border-slate-200 bg-white">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-800">
                    {widget.title}
                </CardTitle>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    Latest records
                </span>
            </CardHeader>
            <CardContent className="space-y-2">
                {rows.length === 0 ? (
                    <p className="text-sm text-slate-500 mt-2">No records found.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {rows.map((row, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5",
                                    "flex flex-col gap-1 text-xs md:text-sm"
                                )}
                            >
                                {columns.map((col, ci) => (
                                    <div
                                        key={col}
                                        className={cn(
                                            "flex justify-between gap-2",
                                            ci === 0
                                                ? "font-semibold text-slate-900"
                                                : "text-slate-700"
                                        )}
                                    >
                                        <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                            {col.replace(/_/g, " ")}
                                        </span>
                                        <span className="text-right">
                                            {formatCell(row[col])}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function formatCell(value) {
    if (value == null) return "-";
    if (typeof value === "number")
        return value.toLocaleString("en-IN", { maximumFractionDigits: 1 });
    if (typeof value === "string" && value.length > 40)
        return value.slice(0, 40) + "…";
    return String(value);
}
