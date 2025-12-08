// FILE: src/pages/MIS.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { listMISDefinitions, runMISReport } from "../api/mis";

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";

import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/components/ui/tabs";

import {
    Calendar,
    FileSpreadsheet,
    Filter,
    RefreshCcw,
    AlertCircle,
    BarChart3,
    Search,
    Download,
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

// ---------- helpers ----------

// Neutral-ish chart palette (soft blues/greys/teal-ish)
const chartColors = ["#0f172a", "#0f766e", "#1e293b", "#475569", "#64748b"];

function formatDateInput(d) {
    return d.toISOString().slice(0, 10);
}

function addDays(base, delta) {
    const d = new Date(base);
    d.setDate(d.getDate() + delta);
    return d;
}

// Used by pie charts to show "Label: value"
function formatPieLabel(entry) {
    if (!entry) return "";
    const value =
        entry.value !== null && entry.value !== undefined ? entry.value : 0;
    return `${entry.label}: ${value}`;
}

// Framer variants
const pageVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: "easeOut" },
    },
};

const sectionVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: (delay = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: "easeOut", delay },
    }),
};

const listContainer = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.06,
        },
    },
};

const listItem = {
    hidden: { opacity: 0, y: 6, scale: 0.98 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.25, ease: "easeOut" },
    },
};

// ---------- main component ----------

export default function MIS() {
    const today = new Date();
    const [dateFrom, setDateFrom] = useState(() => formatDateInput(today));
    const [dateTo, setDateTo] = useState(() => formatDateInput(today));

    const [definitions, setDefinitions] = useState([]);
    const [loadingDefs, setLoadingDefs] = useState(true);

    const [selectedCode, setSelectedCode] = useState("");
    const [filters, setFilters] = useState({});
    const [activePreset, setActivePreset] = useState("today");

    const [result, setResult] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);

    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("summary"); // for desktop tabs + mobile dropdown

    const hasDates = Boolean(dateFrom && dateTo);

    // load MIS definitions
    useEffect(() => {
        let alive = true;
        const load = async () => {
            setLoadingDefs(true);
            setError("");
            try {
                const res = await listMISDefinitions();
                if (!alive) return;
                const defs = res?.data || [];
                setDefinitions(defs);
                if (defs.length > 0) {
                    setSelectedCode(defs[0].code);
                }
            } catch (err) {
                console.error(err);
                if (!alive) return;
                setError(
                    err?.response?.data?.detail ||
                    "Failed to load MIS report definitions."
                );
            } finally {
                if (alive) setLoadingDefs(false);
            }
        };
        load();
        return () => {
            alive = false;
        };
    }, []);

    const activeDefinition = useMemo(
        () => definitions.find((d) => d.code === selectedCode) || null,
        [definitions, selectedCode]
    );

    const handlePresetChange = (preset) => {
        setActivePreset(preset);
        const base = new Date();
        if (preset === "today") {
            const d = formatDateInput(base);
            setDateFrom(d);
            setDateTo(d);
        } else if (preset === "7d") {
            setDateFrom(formatDateInput(addDays(base, -6)));
            setDateTo(formatDateInput(base));
        } else if (preset === "30d") {
            setDateFrom(formatDateInput(addDays(base, -29)));
            setDateTo(formatDateInput(base));
        } else if (preset === "month") {
            const first = new Date(base.getFullYear(), base.getMonth(), 1);
            setDateFrom(formatDateInput(first));
            setDateTo(formatDateInput(base));
        } else if (preset === "custom") {
            // just mark as custom, keep current dates
            setActivePreset("custom");
        }
    };

    const handleDateChange = (setter) => (e) => {
        setActivePreset("custom");
        setter(e.target.value);
    };

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleRun = async () => {
        if (!selectedCode || !hasDates) {
            setError("Please select a report and valid date range.");
            return;
        }

        setLoadingReport(true);
        setError("");
        setResult(null);

        try {
            const body = {
                date_from: dateFrom,
                date_to: dateTo,
                filters,
            };
            const res = await runMISReport(selectedCode, body);
            setResult(res?.data || null);
        } catch (err) {
            console.error(err);
            setError(
                err?.response?.data?.detail ||
                "Failed to run MIS report. Please check filters and try again."
            );
        } finally {
            setLoadingReport(false);
        }
    };

    const summaryCards = useMemo(
        () => (result?.cards && Array.isArray(result.cards) ? result.cards : []),
        [result]
    );

    const charts = useMemo(
        () => (result?.charts && Array.isArray(result.charts) ? result.charts : []),
        [result]
    );

    const categoryLabel = activeDefinition?.category || "MIS";

    // pick charts by type
    const barCharts = charts.filter((c) => c.type === "bar");
    const pieCharts = charts.filter((c) => c.type === "pie");

    const activeReportName = activeDefinition?.name || "No report selected";
    const dateRangeLabel = hasDates
        ? `${dateFrom} → ${dateTo}`
        : "Select a date range";
    const runStatus = loadingReport
        ? "Running report…"
        : result
            ? "Showing latest results"
            : "Awaiting first run";

    // Tabs list config (for desktop + mobile dropdown)
    const tabOptions = [
        { value: "summary", label: "Summary" },
        { value: "charts", label: "Charts" },
    ];
    if (result?.table) {
        tabOptions.push({ value: "details", label: "Detailed view" });
    }

    return (
        <motion.div
            className="relative min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8"
            variants={pageVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="mx-auto w-full max-w-6xl space-y-4 md:space-y-5 lg:space-y-6">
                {/* TOP ROW: badge + device mode */}
                <motion.div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs md:text-sm"
                    custom={0}
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-800 shadow-sm">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="font-medium">MIS · Management Information System</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="inline-flex md:hidden rounded-full bg-white px-2 py-0.5 uppercase tracking-wide border border-slate-200">
                            Mobile view
                        </span>
                        <span className="hidden md:inline-flex lg:hidden rounded-full bg-white px-2 py-0.5 uppercase tracking-wide border border-slate-200">
                            Tablet / Laptop
                        </span>
                        <span className="hidden lg:inline-flex rounded-full bg-white px-2 py-0.5 uppercase tracking-wide border border-slate-200">
                            Desktop workspace
                        </span>
                    </div>
                </motion.div>

                {/* HERO HEADER (gradient, module hero spec) */}
                <motion.div
                    variants={sectionVariants}
                    custom={0.05}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 text-white shadow-md">
                        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%)]" />
                        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7 lg:px-10 lg:py-8">
                            {/* Left: title + description */}
                            <div className="space-y-3 max-w-xl">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm border border-white/20">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px]">
                                        MIS
                                    </span>
                                    Clean, focused analytics for your hospital
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-3xl bg-white/10 text-white shadow-sm border border-white/20">
                                        <BarChart3 className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight">
                                            MIS Reports Console
                                        </h1>
                                        <p className="text-sm md:text-base text-teal-50/90 leading-relaxed">
                                            Generate{" "}
                                            <span className="font-semibold">
                                                clinical, operational and financial
                                            </span>{" "}
                                            MIS reports in a light, distraction-free workspace.
                                        </p>
                                    </div>
                                </div>

                                {activeDefinition?.description && (
                                    <p className="text-xs sm:text-sm text-teal-50/90">
                                        {activeDefinition.description}
                                    </p>
                                )}
                            </div>

                            {/* Right: status chips, context */}
                            <div className="w-full md:w-auto space-y-3">
                                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                                    <Badge className="bg-white/15 text-xs font-semibold border border-white/25 text-white rounded-full px-3 py-1">
                                        IPD / OPD Ready
                                    </Badge>
                                    <Badge className="bg-white/10 text-xs border border-white/20 text-teal-50 rounded-full px-3 py-1">
                                        NABH-aligned KPIs
                                    </Badge>
                                    <Badge className="bg-white/10 text-xs border border-white/20 text-teal-50 rounded-full px-3 py-1">
                                        {categoryLabel}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    <div className="rounded-2xl bg-white/10 px-3 py-2.5 flex flex-col gap-1 border border-white/15">
                                        <span className="text-[11px] font-medium text-teal-50/80 uppercase tracking-wide">
                                            Active report
                                        </span>
                                        <span className="text-sm font-semibold line-clamp-2">
                                            {activeReportName}
                                        </span>
                                    </div>
                                    <div className="rounded-2xl bg-white/10 px-3 py-2.5 flex flex-col gap-1 border border-white/15">
                                        <span className="text-[11px] font-medium text-teal-50/80 uppercase tracking-wide">
                                            Date range
                                        </span>
                                        <span className="text-sm font-semibold">
                                            {dateRangeLabel}
                                        </span>
                                    </div>
                                    <div className="rounded-2xl bg-white/10 px-3 py-2.5 flex flex-col gap-1 border border-white/15">
                                        <span className="text-[11px] font-medium text-teal-50/80 uppercase tracking-wide">
                                            Status
                                        </span>
                                        <span className="text-sm font-semibold flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                            {runStatus}
                                        </span>
                                    </div>
                                </div>
                            </div>
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
                            <Alert className="bg-red-50 border-red-200 text-red-800 rounded-2xl">
                                <AlertCircle className="h-4 w-4 mt-0.5" />
                                <div>
                                    <AlertTitle className="text-red-900 font-semibold">
                                        MIS error
                                    </AlertTitle>
                                    <AlertDescription className="text-red-800/90 text-sm">
                                        {error}
                                    </AlertDescription>
                                </div>
                            </Alert>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* MAIN WORKSPACE GRID */}
                <motion.div
                    variants={sectionVariants}
                    custom={0.1}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-4 lg:gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]"
                >
                    {/* LEFT: CONTROL PANEL (sticky on desktop) */}
                    <div className="space-y-3 lg:space-y-4 lg:sticky lg:top-24 self-start">
                        {/* Report & Dates */}
                        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-xl bg-teal-600 text-white flex items-center justify-center">
                                        <BarChart3 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-semibold text-slate-900">
                                            Report & Date
                                        </CardTitle>
                                        <p className="text-xs text-slate-500">
                                            Choose MIS view and time window
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 pb-3">
                                {/* Report select */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium text-slate-800">
                                            Report
                                        </span>
                                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                            <Filter className="w-3 h-3" />
                                            MIS group
                                        </span>
                                    </div>
                                    {loadingDefs ? (
                                        <Skeleton className="h-9 rounded-xl bg-slate-100" />
                                    ) : (
                                        <Select
                                            value={selectedCode}
                                            onValueChange={(val) => {
                                                setSelectedCode(val);
                                                setResult(null);
                                            }}
                                        >
                                            <SelectTrigger className="h-9 rounded-xl border-slate-200 bg-white text-xs text-slate-900 focus:ring-teal-200">
                                                <SelectValue placeholder="Select report" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white border-slate-200 text-slate-900 max-h-72">
                                                {definitions.map((def) => (
                                                    <SelectItem
                                                        key={def.code}
                                                        value={String(def.code)}
                                                        className="text-xs"
                                                    >
                                                        {def.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Date presets */}
                                <div className="space-y-1">
                                    <span className="text-xs font-medium text-slate-800">
                                        Quick ranges
                                    </span>
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
                                                    "px-3 py-1 rounded-full text-[11px] font-medium border transition-colors",
                                                    activePreset === p.key
                                                        ? "bg-blue-600 text-white border-blue-600"
                                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Date inputs */}
                                <div className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-800">
                                        Custom date range
                                    </span>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                                            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                                            <div className="flex flex-col gap-2 w-full text-xs text-slate-800">
                                                <div className="flex items-center gap-2 w-full">
                                                    <span className="w-10 text-[11px] text-slate-500">
                                                        From
                                                    </span>
                                                    <Input
                                                        type="date"
                                                        value={dateFrom}
                                                        onChange={handleDateChange(setDateFrom)}
                                                        className="h-8 w-full rounded-lg border-slate-200 bg-slate-50 text-xs text-slate-900"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 w-full">
                                                    <span className="w-10 text-[11px] text-slate-500">
                                                        To
                                                    </span>
                                                    <Input
                                                        type="date"
                                                        value={dateTo}
                                                        onChange={handleDateChange(setDateTo)}
                                                        className="h-8 w-full rounded-lg border-slate-200 bg-slate-50 text-xs text-slate-900"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Run button */}
                                <div className="pt-1">
                                    <Button
                                        size="sm"
                                        className="h-9 w-full rounded-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
                                        onClick={handleRun}
                                        disabled={loadingReport || !selectedCode || !hasDates}
                                    >
                                        {loadingReport ? (
                                            <>
                                                <RefreshCcw className="w-4 h-4 animate-spin" />
                                                Running report…
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCcw className="w-4 h-4" />
                                                Run MIS report
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ADVANCED FILTERS */}
                        {activeDefinition &&
                            Array.isArray(activeDefinition.filters) &&
                            activeDefinition.filters.length > 0 && (
                                <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                            <Filter className="w-4 h-4 text-slate-500" />
                                            Advanced filters
                                        </CardTitle>
                                        <span className="text-[11px] text-slate-500">
                                            Tailor output for this report
                                        </span>
                                    </CardHeader>
                                    <CardContent className="pb-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {activeDefinition.filters.map((f) => {
                                                if (f.type === "select" && Array.isArray(f.options)) {
                                                    return (
                                                        <div key={f.key} className="space-y-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-xs font-medium text-slate-800">
                                                                    {f.label}
                                                                </span>
                                                                {f.required && (
                                                                    <span className="text-[11px] text-rose-500">
                                                                        *
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <Select
                                                                value={
                                                                    filters[f.key] !== undefined
                                                                        ? String(filters[f.key])
                                                                        : ""
                                                                }
                                                                onValueChange={(val) =>
                                                                    handleFilterChange(f.key, val)
                                                                }
                                                            >
                                                                <SelectTrigger className="h-9 rounded-xl border-slate-200 bg-slate-50 text-xs text-slate-900">
                                                                    <SelectValue
                                                                        placeholder={`All ${f.label.toLowerCase()}`}
                                                                    />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-white border-slate-200 text-slate-900 max-h-64">
                                                                    <SelectItem
                                                                        value="__ALL__"
                                                                        className="text-xs text-slate-500"
                                                                    >
                                                                        All
                                                                    </SelectItem>
                                                                    {f.options.map((opt) => (
                                                                        <SelectItem
                                                                            key={opt.value}
                                                                            value={String(opt.value)}
                                                                            className="text-xs"
                                                                        >
                                                                            {opt.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    );
                                                }

                                                // default text input
                                                return (
                                                    <div key={f.key} className="space-y-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-medium text-slate-800">
                                                                {f.label}
                                                            </span>
                                                            {f.required && (
                                                                <span className="text-[11px] text-rose-500">
                                                                    *
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Input
                                                            value={filters[f.key] ?? ""}
                                                            onChange={(e) =>
                                                                handleFilterChange(f.key, e.target.value)
                                                            }
                                                            placeholder={`Filter by ${f.label.toLowerCase()}`}
                                                            className="h-9 rounded-xl border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                    </div>

                    {/* RIGHT: RESULTS / WORKSPACE */}
                    <div className="space-y-3 lg:space-y-4">
                        {/* If no result yet – show empty state */}
                        {!loadingReport && !result && (
                            <Card className="rounded-2xl border border-dashed border-slate-300 bg-white shadow-none">
                                <CardContent className="py-10 px-4 sm:px-8 flex flex-col items-center justify-center text-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 mb-1">
                                        <BarChart3 className="w-6 h-6 text-slate-700" />
                                    </div>
                                    <h2 className="text-base md:text-lg font-semibold text-slate-900">
                                        Run your first MIS report
                                    </h2>
                                    <p className="text-sm text-slate-600 max-w-md">
                                        Select a report on the left, choose a date range, add
                                        filters if needed and click{" "}
                                        <span className="font-semibold text-slate-900">
                                            “Run MIS report”
                                        </span>{" "}
                                        to see KPIs, charts and detailed records.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* LOADING SKELETON FOR REPORT */}
                        {loadingReport && (
                            <motion.div
                                className="space-y-4"
                                variants={sectionVariants}
                                custom={0.15}
                                initial="hidden"
                                animate="visible"
                            >
                                <Skeleton className="h-16 rounded-2xl bg-white/80" />
                                <Skeleton className="h-64 rounded-2xl bg-white/80" />
                                <Skeleton className="h-64 rounded-2xl bg-white/80" />
                            </motion.div>
                        )}

                        {/* RESULT AREA */}
                        {!loadingReport && result && (
                            <motion.div
                                variants={sectionVariants}
                                custom={0.15}
                                initial="hidden"
                                animate="visible"
                            >
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    {/* MOBILE: sticky dropdown for sections */}
                                    <div className="sticky top-[4.25rem] z-10 mb-2 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/80 pb-2 md:hidden">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] text-slate-600 font-medium">
                                                Section
                                            </span>
                                            <div className="relative">
                                                <select
                                                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                                                    value={activeTab}
                                                    onChange={(e) => setActiveTab(e.target.value)}
                                                >
                                                    {tabOptions.map((tab) => (
                                                        <option key={tab.value} value={tab.value}>
                                                            {tab.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* DESKTOP/TABLET TABS LIST */}
                                    <div className="hidden md:flex md:flex-row md:items-center md:justify-between gap-2 mb-2">
                                        <TabsList className="flex flex-nowrap overflow-x-auto gap-1 rounded-full bg-slate-100 p-1 border border-slate-200">
                                            {tabOptions.map((tab) => (
                                                <TabsTrigger
                                                    key={tab.value}
                                                    value={tab.value}
                                                    className="px-3 py-1.5 text-xs sm:text-sm rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                                                >
                                                    {tab.label}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>

                                        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span>
                                                Generated for{" "}
                                                <span className="font-semibold text-slate-800">
                                                    {result.name}
                                                </span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* SUMMARY TAB */}
                                    <TabsContent value="summary" className="space-y-4 mt-2">
                                        {summaryCards.length > 0 && (
                                            <section className="space-y-2">
                                                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                                        <BarChart3 className="w-3 h-3" />
                                                    </span>
                                                    Key indicators
                                                </h2>
                                                <motion.div
                                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4"
                                                    variants={listContainer}
                                                    initial="hidden"
                                                    animate="visible"
                                                >
                                                    {summaryCards.map((card, idx) => (
                                                        <motion.div key={idx} variants={listItem}>
                                                            <SummaryCard card={card} />
                                                        </motion.div>
                                                    ))}
                                                </motion.div>
                                            </section>
                                        )}

                                        {barCharts[0] && (
                                            <section className="space-y-2">
                                                <h2 className="text-sm font-semibold text-slate-900">
                                                    Primary trend
                                                </h2>
                                                <MISChartCard chart={barCharts[0]} />
                                            </section>
                                        )}
                                    </TabsContent>

                                    {/* CHARTS TAB */}
                                    <TabsContent value="charts" className="space-y-4 mt-2">
                                        <section className="space-y-2">
                                            <h2 className="text-sm font-semibold text-slate-900">
                                                Chart views
                                            </h2>
                                            <motion.div
                                                className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 md:gap-4"
                                                variants={listContainer}
                                                initial="hidden"
                                                animate="visible"
                                            >
                                                {barCharts.map((chart) => (
                                                    <motion.div key={chart.code} variants={listItem}>
                                                        <MISChartCard chart={chart} />
                                                    </motion.div>
                                                ))}
                                                {pieCharts.map((chart) => (
                                                    <motion.div key={chart.code} variants={listItem}>
                                                        <MISChartCard chart={chart} />
                                                    </motion.div>
                                                ))}
                                            </motion.div>
                                        </section>
                                    </TabsContent>

                                    {/* DETAILS TAB */}
                                    {result.table && (
                                        <TabsContent value="details" className="space-y-4 mt-2">
                                            <section className="space-y-2">
                                                <h2 className="text-sm font-semibold text-slate-900">
                                                    Detailed records
                                                </h2>
                                                <DetailListCard table={result.table} />
                                            </section>
                                        </TabsContent>
                                    )}
                                </Tabs>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

// ---------- summary card ----------

function SummaryCard({ card }) {
    // Plain neutral card
    return (
        <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className={cn(
                "rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm",
                "flex flex-col gap-1.5"
            )}
        >
            <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
                {card.label}
            </div>
            <div className="text-xl md:text-2xl font-semibold leading-tight text-slate-900">
                {typeof card.value === "number"
                    ? card.value.toLocaleString("en-IN", {
                        maximumFractionDigits: 1,
                    })
                    : card.value}
            </div>
            {card.helper && (
                <div className="text-xs text-slate-500">{card.helper}</div>
            )}
        </motion.div>
    );
}

// ---------- chart card ----------

function MISChartCard({ chart }) {
    const type = chart.type || "bar";
    const data = Array.isArray(chart.data) ? chart.data : [];
    const config = chart.config || {};

    if (type === "pie") {
        const pieData =
            data.length > 0
                ? data.map((row, idx) => ({
                    label: row.label ?? row.name ?? `Item ${idx + 1}`,
                    value: row.value ?? row.amount ?? 0,
                }))
                : [];

        return (
            <Card className="rounded-2xl shadow-sm border border-slate-200 bg-white">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-900">
                        {chart.title}
                    </CardTitle>
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 border border-slate-200">
                        Distribution
                    </span>
                </CardHeader>
                <CardContent className="h-56 sm:h-64">
                    {pieData.length === 0 ? (
                        <p className="text-sm text-slate-500 mt-4">No data to display.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    dataKey="value"
                                    nameKey="label"
                                    outerRadius={80}
                                    paddingAngle={3}
                                    labelLine={false}
                                    label={formatPieLabel}
                                >
                                    {pieData.map((entry, index) => (
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
                                        color: "#111827",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>
        );
    }

    // default bar chart
    const normalized =
        data.length > 0
            ? data.map((row, idx) => ({
                label: row.label ?? row.name ?? `Item ${idx + 1}`,
                value: row.value ?? row.amount ?? 0,
            }))
            : [];

    return (
        <Card className="rounded-2xl shadow-sm border border-slate-200 bg-white">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900">
                    {chart.title}
                </CardTitle>
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 border border-slate-200">
                    {config?.label || "Trend"}
                </span>
            </CardHeader>
            <CardContent className="h-56 sm:h-64">
                {normalized.length === 0 ? (
                    <p className="text-sm text-slate-500 mt-4">No data to display.</p>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={normalized}
                            margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                        >
                            <XAxis
                                dataKey="label"
                                stroke="#9ca3af"
                                fontSize={11}
                                tickLine={false}
                                axisLine={{ stroke: "#e5e7eb" }}
                            />
                            <YAxis
                                stroke="#9ca3af"
                                fontSize={11}
                                tickLine={false}
                                axisLine={{ stroke: "#e5e7eb" }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: "#111827",
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

// ---------- detail list (desktop table + mobile cards + search + filters) ----------

function DetailListCard({ table }) {
    const rows = Array.isArray(table.rows) ? table.rows : [];
    const columns =
        table.columns && table.columns.length > 0
            ? table.columns
            : rows[0]
                ? Object.keys(rows[0])
                : [];

    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilterChip, setActiveFilterChip] = useState("all");

    if (rows.length === 0) {
        return (
            <Card className="rounded-2xl shadow-sm border border-slate-200 bg-white">
                <CardContent className="py-6 flex items-center justify-center">
                    <p className="text-sm text-slate-500">No records found.</p>
                </CardContent>
            </Card>
        );
    }

    const filterChips = [
        { key: "all", label: "All" },
        { key: "nonZero", label: "Non-zero values" },
    ];

    const filteredRows = rows.filter((row) => {
        // Search across all stringified values
        if (searchTerm) {
            const haystack = Object.values(row)
                .map((v) => (v == null ? "" : String(v)))
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(searchTerm.toLowerCase())) return false;
        }

        // Chip filter: "nonZero" => at least one numeric > 0
        if (activeFilterChip === "nonZero") {
            const hasNonZero = Object.values(row).some(
                (v) => typeof v === "number" && v > 0
            );
            if (!hasNonZero) return false;
        }

        return true;
    });

    const handleExport = () => {
        // simple CSV export for now – production can be replaced with API export
        const csvHeader = columns.join(",");
        const csvBody = filteredRows
            .map((row) =>
                columns
                    .map((col) => {
                        const raw = row[col];
                        const value = raw == null ? "" : String(raw);
                        // basic CSV escaping
                        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    })
                    .join(",")
            )
            .join("\n");

        const blob = new Blob([csvHeader + "\n" + csvBody], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mis-report.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Card className="rounded-2xl shadow-sm border border-slate-200 bg-white">
            <CardContent className="py-3 flex flex-col gap-3 max-h-[520px] md:max-h-[560px] overflow-hidden">
                {/* Search + filters + primary button bar (listing spec) */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {/* Search + chips left */}
                    <div className="space-y-2">
                        {/* Search input */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search in records"
                                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                            />
                        </div>

                        {/* Filter chips */}
                        <div className="flex flex-wrap gap-1.5">
                            {filterChips.map((chip) => (
                                <button
                                    key={chip.key}
                                    type="button"
                                    onClick={() => setActiveFilterChip(chip.key)}
                                    className={cn(
                                        "inline-flex items-center rounded-full px-3 py-1 text-xs sm:text-sm transition",
                                        activeFilterChip === chip.key
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Primary action button (same style as “New”) */}
                    <div className="flex justify-start sm:justify-end">
                        <Button
                            type="button"
                            onClick={handleExport}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </Button>
                    </div>
                </div>

                {/* CONTENT SCROLLER */}
                <div className="mt-1 flex-1 overflow-y-auto pr-1.5">
                    {/* Desktop: table layout */}
                    <div className="hidden md:block">
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="min-w-full text-xs md:text-sm bg-white">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                        {columns.map((col) => (
                                            <th
                                                key={col}
                                                className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-600 border-b border-slate-200"
                                            >
                                                {col.replace(/_/g, " ")}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row, idx) => (
                                        <tr
                                            key={idx}
                                            className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors"
                                        >
                                            {columns.map((col, ci) => (
                                                <td
                                                    key={col}
                                                    className={cn(
                                                        "px-3 py-2 text-[11px] md:text-sm text-slate-800 align-top",
                                                        ci === 0 && "font-semibold text-slate-900"
                                                    )}
                                                >
                                                    <span className="line-clamp-2">
                                                        {formatCell(row[col])}
                                                    </span>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile: card-based layout */}
                    <div className="grid gap-3 md:hidden mt-1">
                        <AnimatePresence>
                            {filteredRows.map((row, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm flex flex-col gap-1"
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
                                            <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                                {col.replace(/_/g, " ")}
                                            </span>
                                            <span className="text-xs text-right truncate max-w-[60%]">
                                                {formatCell(row[col])}
                                            </span>
                                        </div>
                                    ))}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function formatCell(value) {
    if (value == null) return "—";
    if (typeof value === "number") {
        return value.toLocaleString("en-IN", { maximumFractionDigits: 1 });
    }
    if (typeof value === "string" && value.length > 80) {
        return value.slice(0, 80) + "…";
    }
    return String(value);
}
