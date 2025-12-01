// frontend/src/opd/Followups.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    listFollowups,
    updateFollowup,
    scheduleFollowup,
    getFreeSlots,
} from "../api/opd";
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
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from "@/components/ui/select";

import {
    Bell,
    CalendarDays,
    ClipboardList,
    Clock,
    User,
    Stethoscope,
    AlertCircle,
} from "lucide-react";

const todayStr = () => new Date().toISOString().slice(0, 10);

const STATUS_LABEL = {
    waiting: "Waiting",
    scheduled: "Scheduled",
    completed: "Completed",
    cancelled: "Cancelled",
    "*": "All",
};

const STATUS_BADGE = {
    waiting: "bg-amber-50 text-amber-700",
    scheduled: "bg-blue-50 text-blue-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-700",
};

function prettyDate(d) {
    if (!d) return "";
    try {
        return new Date(d).toLocaleDateString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return d;
    }
}

export default function Followups() {
    const [status, setStatus] = useState("waiting");
    const [doctorId, setDoctorId] = useState(null);
    const [dateFrom, setDateFrom] = useState(todayStr());
    const [dateTo, setDateTo] = useState(todayStr());
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const [editTarget, setEditTarget] = useState(null);
    const [editDate, setEditDate] = useState("");
    const [editNote, setEditNote] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    const [schedTarget, setSchedTarget] = useState(null);
    const [schedDate, setSchedDate] = useState("");
    const [schedTime, setSchedTime] = useState("");
    const [slots, setSlots] = useState([]);
    const [schedSaving, setSchedSaving] = useState(false);
    const [slotsLoading, setSlotsLoading] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const params = {
                status,
                doctor_id: doctorId || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
            };
            const { data } = await listFollowups(params);
            setRows(data || []);
        } catch {
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, doctorId, dateFrom, dateTo]);

    const handleDoctorChange = (id) => {
        setDoctorId(id);
    };

    const openEdit = (row) => {
        setEditTarget(row);
        setEditDate(row.due_date);
        setEditNote(row.note || "");
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        if (!editTarget) return;
        try {
            setEditSaving(true);
            await updateFollowup(editTarget.id, {
                due_date: editDate,
                note: editNote || undefined,
            });
            toast.success("Follow-up updated");
            setEditTarget(null);
            await load();
        } catch {
            // toast handled globally
        } finally {
            setEditSaving(false);
        }
    };

    const loadSlots = async (row, dateStr) => {
        if (!row?.doctor_id || !dateStr) {
            setSlots([]);
            return;
        }
        try {
            setSlotsLoading(true);
            const { data } = await getFreeSlots({
                doctorUserId: row.doctor_id,
                date: dateStr,
            });
            setSlots(data || []);
        } catch {
            setSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    };

    const openSchedule = async (row) => {
        setSchedTarget(row);
        const d = row.due_date;
        setSchedDate(d);
        setSchedTime("");
        await loadSlots(row, d);
    };

    const onSchedDateChange = async (e) => {
        const d = e.target.value;
        setSchedDate(d);
        if (schedTarget) {
            await loadSlots(schedTarget, d);
        }
    };

    const saveSchedule = async (e) => {
        e.preventDefault();
        if (!schedTarget) return;
        if (!schedTime) {
            toast.error("Select a time slot");
            return;
        }
        try {
            setSchedSaving(true);
            await scheduleFollowup(schedTarget.id, {
                date: schedDate || undefined,
                slot_start: schedTime,
            });
            toast.success("Follow-up scheduled");
            setSchedTarget(null);
            setSlots([]);
            await load();
        } catch {
            // toast handled globally
        } finally {
            setSchedSaving(false);
        }
    };

    // ---- derived stats ----
    const stats = useMemo(() => {
        const base = {
            total: rows.length,
            waiting: 0,
            scheduled: 0,
            completed: 0,
            cancelled: 0,
        };
        for (const r of rows) {
            if (base[r.status] !== undefined) base[r.status] += 1;
        }
        return base;
    }, [rows]);

    return (
        <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 md:px-6">
            <div className="mx-auto max-w-5xl space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
                            </span>
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">
                                Follow-up Tracker
                            </p>
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                            OPD Follow-ups
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            View pending follow-ups, reschedule due dates, and confirm them
                            into real OPD appointments.
                        </p>
                    </div>

                    <div className="hidden text-right text-xs text-slate-500 md:block">
                        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <ClipboardList className="h-3 w-3" />
                            <span>Continuity of care</span>
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1">
                            <CalendarDays className="h-3 w-3" />
                            <span>
                                {prettyDate(dateFrom)} – {prettyDate(dateTo)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main card */}
                <Card className="border-slate-200 shadow-sm rounded-3xl">
                    <CardHeader className="border-b border-slate-100 pb-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div className="grid w-full gap-3 md:grid-cols-[2fr,1.3fr,1fr,1fr] md:items-end">
                                <DoctorPicker value={doctorId} onChange={handleDoctorChange} />

                                {/* Status filter */}
                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <Bell className="h-3 w-3" />
                                        Status
                                    </label>
                                    <Select
                                        value={status}
                                        onValueChange={(val) => setStatus(val)}
                                    >
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="waiting">Waiting</SelectItem>
                                            <SelectItem value="scheduled">Scheduled</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                            <SelectItem value="*">All</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Date from/to */}
                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <CalendarDays className="h-3 w-3" />
                                        From
                                    </label>
                                    <Input
                                        type="date"
                                        className="h-9"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <CalendarDays className="h-3 w-3" />
                                        To
                                    </label>
                                    <Input
                                        type="date"
                                        className="h-9"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:w-auto">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={load}
                                    disabled={loading}
                                    className="gap-1"
                                >
                                    <Clock className="h-3 w-3" />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        {/* Stats row */}
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <Badge
                                variant="outline"
                                className="flex items-center gap-1 rounded-full border-slate-200 bg-slate-50"
                            >
                                <ClipboardList className="h-3 w-3" />
                                <span>Total</span>
                                <span className="font-semibold">{stats.total}</span>
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-200 bg-amber-50 text-amber-700"
                            >
                                Waiting: {stats.waiting}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-200 bg-blue-50 text-blue-700"
                            >
                                Scheduled: {stats.scheduled}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-200 bg-emerald-50 text-emerald-700"
                            >
                                Completed: {stats.completed}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-200 bg-slate-100 text-slate-700"
                            >
                                Cancelled: {stats.cancelled}
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {/* List */}
                        {loading ? (
                            <div className="space-y-3 py-4">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3"
                                    >
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-52" />
                                            <Skeleton className="h-3 w-64" />
                                        </div>
                                        <Skeleton className="h-7 w-20" />
                                    </div>
                                ))}
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                                    <AlertCircle className="h-5 w-5 text-slate-500" />
                                </div>
                                <div className="font-medium text-slate-700">
                                    No follow-ups for this filter
                                </div>
                                <p className="max-w-md text-xs text-slate-500">
                                    Adjust status, doctor, or date range above to see past and
                                    upcoming follow-ups.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 pt-1 text-sm">
                                {rows.map((r) => {
                                    const badgeCls =
                                        STATUS_BADGE[r.status] ||
                                        "bg-slate-100 text-slate-700";
                                    return (
                                        <div
                                            key={r.id}
                                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm md:flex-row md:items-center md:justify-between"
                                        >
                                            {/* left block */}
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-xs font-semibold text-slate-900">
                                                        {prettyDate(r.due_date)}
                                                    </span>
                                                    <span className="mx-0.5 text-slate-400">•</span>
                                                    <span className="flex items-center gap-1 text-sm font-medium text-slate-900">
                                                        <User className="h-3.5 w-3.5 text-slate-500" />
                                                        {r.patient_name}
                                                    </span>
                                                    <span className="mx-0.5 text-slate-400">•</span>
                                                    <span className="text-[11px] text-slate-500">
                                                        UHID {r.patient_uhid}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                                                    <span>
                                                        Dr. {r.doctor_name} · {r.department_name}
                                                    </span>
                                                    <span className="mx-1 text-slate-300">•</span>
                                                    <span>Status:</span>
                                                    <Badge
                                                        className={`border-none px-2 py-0.5 text-[11px] font-semibold uppercase ${badgeCls}`}
                                                    >
                                                        {STATUS_LABEL[r.status] || r.status}
                                                    </Badge>
                                                </div>

                                                {r.note && (
                                                    <div className="text-[11px] text-slate-600">
                                                        Note: {r.note}
                                                    </div>
                                                )}

                                                {r.status === "scheduled" && r.appointment_id && (
                                                    <div className="text-[11px] text-emerald-700">
                                                        Linked to appointment # {r.appointment_id}
                                                    </div>
                                                )}
                                            </div>

                                            {/* right actions */}
                                            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                                                {r.status === "waiting" && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => openEdit(r)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => openSchedule(r)}
                                                        >
                                                            Schedule
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Edit panel */}
                {editTarget && (
                    <Card className="border-slate-200 shadow-sm rounded-3xl">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">
                                        Edit Follow-up Date & Note
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        {editTarget.patient_name} · UHID {editTarget.patient_uhid}
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-slate-500"
                                    type="button"
                                    onClick={() => setEditTarget(null)}
                                >
                                    Close
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={saveEdit}
                                className="grid gap-3 md:grid-cols-[1fr,2fr,auto] md:items-end"
                            >
                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <CalendarDays className="h-3 w-3" />
                                        Due date
                                    </label>
                                    <Input
                                        type="date"
                                        value={editDate}
                                        onChange={(e) => setEditDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <Stethoscope className="h-3 w-3" />
                                        Note
                                    </label>
                                    <Input
                                        value={editNote}
                                        onChange={(e) => setEditNote(e.target.value)}
                                        placeholder="Short instruction for next visit…"
                                    />
                                </div>
                                <Button type="submit" disabled={editSaving}>
                                    {editSaving ? "Saving…" : "Save changes"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Schedule panel */}
                {schedTarget && (
                    <Card className="border-slate-200 shadow-sm rounded-3xl">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">
                                        Schedule Follow-up Appointment
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        {schedTarget.patient_name} · UHID {schedTarget.patient_uhid} ·
                                        Dr. {schedTarget.doctor_name}
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-slate-500"
                                    type="button"
                                    onClick={() => {
                                        setSchedTarget(null);
                                        setSlots([]);
                                    }}
                                >
                                    Close
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={saveSchedule} className="space-y-4 text-sm">
                                <div className="grid gap-3 md:grid-cols-[1fr,2fr] md:items-start">
                                    {/* date */}
                                    <div className="space-y-1">
                                        <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                            <CalendarDays className="h-3 w-3" />
                                            Date
                                        </label>
                                        <Input
                                            type="date"
                                            value={schedDate}
                                            onChange={onSchedDateChange}
                                        />
                                    </div>

                                    {/* time + slots */}
                                    <div className="space-y-1">
                                        <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                            <Clock className="h-3 w-3" />
                                            Time slot
                                        </label>

                                        {slotsLoading ? (
                                            <div className="text-[11px] text-slate-500">
                                                Loading slots…
                                            </div>
                                        ) : slots.length === 0 ? (
                                            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                                                <AlertCircle className="mt-[1px] h-3 w-3" />
                                                <span>
                                                    No free slots found for this date. You can still type a
                                                    custom time below.
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {slots.map((t) => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => setSchedTime(t)}
                                                        className={[
                                                            "rounded-full border px-3 py-1 text-[11px] transition",
                                                            schedTime === t
                                                                ? "border-slate-900 bg-slate-900 text-white"
                                                                : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                                                        ].join(" ")}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <Input
                                            type="time"
                                            className="mt-2"
                                            value={schedTime}
                                            onChange={(e) => setSchedTime(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={schedSaving}>
                                        {schedSaving ? "Scheduling…" : "Confirm schedule"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
