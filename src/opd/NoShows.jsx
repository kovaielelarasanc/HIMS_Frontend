// frontend/src/opd/NoShow.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    listNoShowAppointments,
    rescheduleAppointment,
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
    CalendarDays,
    User,
    Clock,
    AlertCircle,
    RotateCcw,
} from "lucide-react";

const todayStr = () => new Date().toISOString().slice(0, 10);

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

export default function NoShow() {
    const [doctorId, setDoctorId] = useState(null);
    const [date, setDate] = useState(todayStr());
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const [target, setTarget] = useState(null);
    const [newDate, setNewDate] = useState("");
    const [newTime, setNewTime] = useState("");
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const params = {
                for_date: date,
                doctor_id: doctorId || undefined,
            };
            const { data } = await listNoShowAppointments(params);
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
    }, [doctorId, date]);

    const handleDoctorChange = (id) => {
        setDoctorId(id);
    };

    const openReschedule = (row) => {
        setTarget(row);
        setNewDate(row.date);
        setNewTime(row.slot_start);
    };

    const saveReschedule = async (e) => {
        e.preventDefault();
        if (!target) return;
        if (!newDate || !newTime) {
            toast.error("Select date and time");
            return;
        }
        try {
            setSaving(true);
            await rescheduleAppointment(target.id, {
                date: newDate,
                slot_start: newTime,
                create_new: true, // keep old as history
            });
            toast.success("No-show rescheduled as new appointment");
            setTarget(null);
            await load();
        } catch {
            // handled globally
        } finally {
            setSaving(false);
        }
    };

    const total = useMemo(() => rows.length, [rows]);

    return (
        <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 md:px-6">
            <div className="mx-auto max-w-5xl space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                            </span>
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose-700">
                                No-Show Recovery
                            </p>
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                            No-show Appointments
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Track patients who missed their appointment and quickly reschedule
                            them into the OPD calendar.
                        </p>
                    </div>

                    <div className="hidden text-right text-xs text-slate-500 md:block">
                        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <RotateCcw className="h-3 w-3" />
                            <span>Improve utilisation</span>
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1">
                            <CalendarDays className="h-3 w-3" />
                            <span>{prettyDate(date)}</span>
                        </div>
                    </div>
                </div>

                {/* Main card */}
                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 pb-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div className="grid w-full gap-3 md:grid-cols-[2fr,1fr] md:items-end">
                                <DoctorPicker value={doctorId} onChange={handleDoctorChange} />

                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <CalendarDays className="h-3 w-3" />
                                        For date
                                    </label>
                                    <Input
                                        type="date"
                                        className="h-9"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
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

                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                            <Badge
                                variant="outline"
                                className="flex items-center gap-1 rounded-full border-slate-200 bg-slate-50"
                            >
                                <AlertCircle className="h-3 w-3 text-rose-600" />
                                <span>Total no-shows</span>
                                <span className="font-semibold">{total}</span>
                            </Badge>
                            <span className="text-[11px] text-slate-500">
                                Recover missed visits by creating a fresh appointment.
                            </span>
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
                                        <Skeleton className="h-7 w-28" />
                                    </div>
                                ))}
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                                    <AlertCircle className="h-5 w-5 text-slate-500" />
                                </div>
                                <div className="font-medium text-slate-700">
                                    No no-show appointments for this filter
                                </div>
                                <p className="max-w-md text-xs text-slate-500">
                                    Change the doctor or date above to check other days.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 pt-1 text-sm">
                                {rows.map((r) => (
                                    <div
                                        key={r.id}
                                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm md:flex-row md:items-center md:justify-between"
                                    >
                                        {/* left block */}
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-xs font-semibold text-slate-900">
                                                    {prettyDate(r.date)} • {r.slot_start}
                                                </span>
                                                <span className="mx-0.5 text-slate-300">•</span>
                                                <span className="flex items-center gap-1 text-sm font-medium text-slate-900">
                                                    <User className="h-3.5 w-3.5 text-slate-500" />
                                                    {r.patient_name}
                                                </span>
                                                <span className="mx-0.5 text-slate-400">•</span>
                                                <span className="text-[11px] text-slate-500">
                                                    UHID {r.uhid}
                                                </span>
                                            </div>

                                            <div className="text-[11px] text-slate-500">
                                                {r.department_name} · Dr. {r.doctor_name} · Purpose:{" "}
                                                {r.purpose || "Consultation"}
                                            </div>
                                        </div>

                                        {/* right actions */}
                                        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                                            <Button
                                                size="sm"
                                                className="gap-1"
                                                onClick={() => openReschedule(r)}
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                                Reschedule
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Reschedule panel */}
                {target && (
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">
                                        Reschedule No-show
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        {target.patient_name} · UHID {target.uhid} · Dr.{" "}
                                        {target.doctor_name}
                                    </CardDescription>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-slate-500"
                                    onClick={() => setTarget(null)}
                                >
                                    Close
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <form
                                onSubmit={saveReschedule}
                                className="grid gap-3 md:grid-cols-[1fr,1fr,auto] md:items-end text-sm"
                            >
                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <CalendarDays className="h-3 w-3" />
                                        New date
                                    </label>
                                    <Input
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <Clock className="h-3 w-3" />
                                        New time
                                    </label>
                                    <Input
                                        type="time"
                                        value={newTime}
                                        onChange={(e) => setNewTime(e.target.value)}
                                    />
                                </div>
                                <Button type="submit" disabled={saving}>
                                    {saving ? "Rescheduling…" : "Create new appointment"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
