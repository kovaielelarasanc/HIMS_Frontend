// frontend/src/opd/Dashboard.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { fetchOpdDashboard } from "../api/opd";
import DoctorPicker from "./components/DoctorPicker";

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import {
    CalendarRange,
    Activity,
    Users,
    Stethoscope,
    Clock3,
    AlertTriangle,
    TrendingUp,
    CheckCircle2,
} from "lucide-react";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}
function addDaysStr(dateStr, delta) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
}
function prettyRange(from, to) {
    if (!from || !to) return "";
    try {
        const d1 = new Date(from);
        const d2 = new Date(to);
        const sameYear = d1.getFullYear() === d2.getFullYear();

        const optsFrom = {
            day: "2-digit",
            month: "short",
            ...(sameYear ? {} : { year: "numeric" }),
        };
        const optsTo = {
            day: "2-digit",
            month: "short",
            year: "numeric",
        };
        return `${d1.toLocaleDateString("en-IN", optsFrom)} → ${d2.toLocaleDateString(
            "en-IN",
            optsTo
        )}`;
    } catch {
        return `${from} → ${to}`;
    }
}

export default function OpdDashboard() {
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [doctorId, setDoctorId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    // Initialise default range (last 7 days)
    useEffect(() => {
        const to = todayStr();
        const from = addDaysStr(to, -6);
        setDateFrom(from);
        setDateTo(to);
    }, []);

    const load = useCallback(
        async (opts = {}) => {
            const from = opts.dateFrom || dateFrom;
            const to = opts.dateTo || dateTo;
            if (!from || !to) return;

            try {
                setLoading(true);
                const { data } = await fetchOpdDashboard({
                    dateFrom: from,
                    dateTo: to,
                    doctorId: doctorId || undefined,
                });
                setData(data);
            } catch (e) {
                console.error(e);
                toast.error(
                    e?.response?.data?.detail || "Failed to load OPD dashboard"
                );
            } finally {
                setLoading(false);
            }
        },
        [dateFrom, dateTo, doctorId]
    );

    useEffect(() => {
        if (dateFrom && dateTo) {
            load();
        }
    }, [dateFrom, dateTo, doctorId, load]);

    const handleDoctorChange = (id) => {
        setDoctorId(id);
    };

    const stats = data || {};
    const ap = stats.appointments || {};
    const fu = stats.followups || {};
    const doctorStats = stats.doctor_stats || [];

    const chartData = useMemo(
        () =>
            (doctorStats || []).map((d) => ({
                name: d.doctor_name || `#${d.doctor_id}`,
                total: d.total_appointments || 0,
                completed: d.completed || 0,
                no_show: d.no_show || 0,
            })),
        [doctorStats]
    );

    const rangeObj = stats.range || {};
    const rangeLabel =
        rangeObj.date_from && rangeObj.date_to
            ? prettyRange(rangeObj.date_from, rangeObj.date_to)
            : prettyRange(dateFrom, dateTo);

    const totalAppointments = ap.total ?? 0;
    const showSkeleton = loading && !data;

    return (
        <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 md:px-6">
            <div className="mx-auto max-w-6xl space-y-6">
                {/* HEADER */}
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                                OPD Analytics
                            </p>
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                            OPD Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Quick view of OPD appointments, follow-ups and doctor workload for
                            the selected date range.
                        </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 text-xs text-slate-500 md:items-end">
                        <Badge
                            variant="outline"
                            className="flex items-center gap-1 rounded-full border-slate-500 bg-white px-3 py-1"
                        >
                            <CalendarRange className="h-3 w-3" />
                            <span>{rangeLabel}</span>
                        </Badge>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-500 bg-slate-50 text-[11px]"
                            >
                                {doctorId
                                    ? "Filtered by specific doctor"
                                    : "All doctors in OPD"}
                            </Badge>
                            <span className="text-[11px] text-slate-400">
                                {loading ? "Refreshing…" : "Live clinical summary"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* FILTERS */}
                <Card className="rounded-3xl border-slate-500 shadow-sm">
                    <CardHeader className="border-b border-slate-100 pb-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <CalendarRange className="h-4 w-4" />
                                Date & Doctor Filters
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const to = todayStr();
                                    const from = addDaysStr(to, -6);
                                    setDateFrom(from);
                                    setDateTo(to);
                                    setDoctorId(null);
                                }}
                            >
                                Last 7 days
                            </Button>
                        </div>
                        <CardDescription className="mt-1 text-xs text-slate-500">
                            Use this view daily for clinical huddle, OPD utilisation review
                            and doctor-wise load balancing.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                    From date
                                </label>
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                    To date
                                </label>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                />
                            </div>
                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => load({ dateFrom, dateTo })}
                                    disabled={loading}
                                >
                                    {loading ? "Refreshing…" : "Refresh"}
                                </Button>
                            </div>
                        </div>

                        <DoctorPicker
                            value={doctorId}
                            onChange={handleDoctorChange}
                            label="Filter by doctor (optional)"
                        />
                    </CardContent>
                </Card>

                {/* TOP SUMMARY CARDS */}
                <div className="grid gap-3 md:grid-cols-4">
                    {/* Total appointments */}
                    <Card className="rounded-3xl border-slate-500 shadow-sm">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-medium text-slate-500">
                                Total appointments
                                <Activity className="h-4 w-4 text-slate-400" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {showSkeleton ? (
                                <>
                                    <Skeleton className="mb-1 h-7 w-16" />
                                    <Skeleton className="h-3 w-32" />
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-semibold text-slate-900">
                                        {ap.total ?? "–"}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Unique patients:{" "}
                                        <span className="font-semibold">
                                            {ap.unique_patients ?? "–"}
                                        </span>
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Completed */}
                    <Card className="rounded-3xl border-slate-500 shadow-sm">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-medium text-slate-500">
                                Completed visits
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {showSkeleton ? (
                                <>
                                    <Skeleton className="mb-1 h-7 w-16" />
                                    <Skeleton className="h-3 w-40" />
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-semibold text-slate-900">
                                        {ap.completed ?? "–"}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        In progress:{" "}
                                        <span className="font-semibold">
                                            {ap.in_progress ?? 0}
                                        </span>{" "}
                                        · Checked-in:{" "}
                                        <span className="font-semibold">
                                            {ap.checked_in ?? 0}
                                        </span>
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* No-show */}
                    <Card className="rounded-3xl border-slate-500 shadow-sm">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-medium text-slate-500">
                                No-show & cancellations
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {showSkeleton ? (
                                <>
                                    <Skeleton className="mb-1 h-7 w-16" />
                                    <Skeleton className="h-3 w-32" />
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-semibold text-slate-900">
                                        {ap.no_show ?? "–"}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Cancelled:{" "}
                                        <span className="font-semibold">
                                            {ap.cancelled ?? 0}
                                        </span>
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Follow-ups */}
                    <Card className="rounded-3xl border-slate-500 shadow-sm">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-medium text-slate-500">
                                Follow-ups
                                <Stethoscope className="h-4 w-4 text-sky-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {showSkeleton ? (
                                <>
                                    <Skeleton className="mb-1 h-7 w-16" />
                                    <Skeleton className="h-3 w-44" />
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-semibold text-slate-900">
                                        {fu.total ?? "–"}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Waiting:{" "}
                                        <span className="font-semibold">
                                            {fu.waiting ?? 0}
                                        </span>{" "}
                                        · Scheduled:{" "}
                                        <span className="font-semibold">
                                            {fu.scheduled ?? 0}
                                        </span>
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* DOCTOR-WISE LOAD + HIGHLIGHTS */}
                <div className="grid gap-4 lg:grid-cols-3">
                    {/* Chart */}
                    <Card className="rounded-3xl border-slate-500 shadow-sm lg:col-span-2">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    Doctor-wise OPD load
                                    <Users className="h-4 w-4 text-slate-400" />
                                </CardTitle>
                                {totalAppointments > 0 && (
                                    <Badge className="rounded-full bg-slate-900 text-[11px] font-normal text-white">
                                        Total: {totalAppointments}
                                    </Badge>
                                )}
                            </div>
                            <CardDescription className="mt-1 text-xs text-slate-500">
                                Each bar represents total appointments per doctor in the chosen
                                period.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-72 pt-2">
                            {chartData.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                                    {loading ? "Loading…" : "No data in selected range"}
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 11 }}
                                            interval={0}
                                            height={40}
                                        />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="total" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    {/* Top doctors panel */}
                    <Card className="rounded-3xl border-slate-500 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between text-sm font-medium text-slate-700">
                                Highlights
                                <TrendingUp className="h-4 w-4 text-slate-400" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-1 text-xs">
                            {/* Top by appointments */}
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800">
                                        Top by appointments
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                                    >
                                        Volume
                                    </Badge>
                                </div>
                                {stats.top_doctor_by_appointments ? (
                                    <>
                                        <div className="mt-1 text-[13px] font-medium text-slate-900">
                                            {stats.top_doctor_by_appointments.doctor_name}
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                            Dept:{" "}
                                            {stats.top_doctor_by_appointments.department_name || "—"}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Total appointments:{" "}
                                            <span className="font-semibold">
                                                {
                                                    stats.top_doctor_by_appointments
                                                        .total_appointments
                                                }
                                            </span>
                                            <br />
                                            No-show:{" "}
                                            <span className="font-semibold">
                                                {stats.top_doctor_by_appointments.no_show}
                                            </span>
                                            <br />
                                            Follow-ups in range:{" "}
                                            <span className="font-semibold">
                                                {
                                                    stats.top_doctor_by_appointments
                                                        .followups_in_range
                                                }
                                            </span>
                                        </p>
                                    </>
                                ) : (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        {loading ? "Calculating…" : "No doctor data in this range."}
                                    </p>
                                )}
                            </div>

                            {/* Top by completed (if available) */}
                            <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800">
                                        Top by completed visits
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-sky-200 bg-sky-50 text-[10px] text-sky-700"
                                    >
                                        Quality
                                    </Badge>
                                </div>
                                {stats.top_doctor_by_completed ? (
                                    <>
                                        <div className="mt-1 text-[13px] font-medium text-slate-900">
                                            {stats.top_doctor_by_completed.doctor_name}
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                            Dept:{" "}
                                            {stats.top_doctor_by_completed.department_name || "—"}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Completed visits:{" "}
                                            <span className="font-semibold">
                                                {stats.top_doctor_by_completed.completed}
                                            </span>
                                        </p>
                                    </>
                                ) : (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        {loading
                                            ? "Calculating…"
                                            : "Waiting for enough completed visits."}
                                    </p>
                                )}
                            </div>

                            {/* Quick interpretation */}
                            <p className="text-[10px] leading-relaxed text-slate-500">
                                Use these insights for scheduling next week’s OPD, balancing
                                high-load doctors and monitoring no-show trends.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* DOCTOR TABLE */}
                <Card className="rounded-3xl border-slate-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-sm font-medium text-slate-700">
                            Doctor-wise breakdown
                            <Users className="h-4 w-4 text-slate-400" />
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs text-slate-500">
                            Each row shows total load, outcomes and follow-ups for a doctor in
                            the selected range.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto pt-2">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b text-xs text-slate-500">
                                    <th className="py-2 pr-2 text-left">Doctor</th>
                                    <th className="py-2 px-2 text-left">Department</th>
                                    <th className="py-2 px-2 text-right">Total</th>
                                    <th className="py-2 px-2 text-right">Completed</th>
                                    <th className="py-2 px-2 text-right">No-show</th>
                                    <th className="py-2 px-2 text-right">Cancelled</th>
                                    <th className="py-2 pl-2 text-right">Follow-ups</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doctorStats.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="py-4 text-center text-xs text-slate-500"
                                        >
                                            {loading ? "Loading…" : "No data to show"}
                                        </td>
                                    </tr>
                                )}
                                {doctorStats.map((d) => (
                                    <tr
                                        key={d.doctor_id}
                                        className="border-b last:border-0 hover:bg-slate-50/70"
                                    >
                                        <td className="py-2 pr-2 text-slate-800">
                                            {d.doctor_name}
                                        </td>
                                        <td className="py-2 px-2 text-slate-600">
                                            {d.department_name || "—"}
                                        </td>
                                        <td className="py-2 px-2 text-right">
                                            {d.total_appointments}
                                        </td>
                                        <td className="py-2 px-2 text-right">{d.completed}</td>
                                        <td className="py-2 px-2 text-right">{d.no_show}</td>
                                        <td className="py-2 px-2 text-right">{d.cancelled}</td>
                                        <td className="py-2 pl-2 text-right">
                                            {d.followups_in_range}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
