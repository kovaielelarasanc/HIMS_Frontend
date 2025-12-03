// frontend/src/opd/Schedules.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
    saveDoctorSchedule,
    fetchDoctorSchedules,
    deleteDoctorSchedule,
} from '../api/opd'
import DoctorPicker from './components/DoctorPicker'

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, Trash2, CalendarDays } from 'lucide-react'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Schedules() {
    const [doctorId, setDoctorId] = useState(null)
    const [weekday, setWeekday] = useState('0')
    const [start, setStart] = useState('09:00')
    const [end, setEnd] = useState('13:00')
    const [slotMinutes, setSlotMinutes] = useState('15')

    const [list, setList] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState(null)

    const handleDoctorChange = useCallback((id /*, meta */) => {
        setDoctorId(id)
    }, [])

    const load = useCallback(async () => {
        if (!doctorId) {
            setList([])
            return
        }
        try {
            setLoading(true)
            const { data } = await fetchDoctorSchedules(doctorId)
            setList(data || [])
        } catch (e) {
            console.error(e)
            toast.error('Failed to load schedules')
        } finally {
            setLoading(false)
        }
    }, [doctorId])

    useEffect(() => {
        load()
    }, [load])

    const add = async (e) => {
        e?.preventDefault?.()
        if (!doctorId) {
            toast.error('Select doctor first')
            return
        }
        const weekdayNum = Number(weekday)

        // Simple duplicate day guard (same doctor + weekday)
        if (list.some((s) => s.weekday === weekdayNum)) {
            toast.error(
                'Schedule for this weekday already exists. Edit / delete existing slot instead.',
            )
            return
        }

        try {
            setSaving(true)
            await saveDoctorSchedule({
                doctor_user_id: doctorId,
                weekday: weekdayNum,
                start_time: start,
                end_time: end,
                slot_minutes: Number(slotMinutes) || 15,
            })
            toast.success('Schedule saved')
            load()
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Failed to save schedule')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (id) => {
        if (!window.confirm('Delete this schedule slot?')) return
        try {
            setDeletingId(id)
            await deleteDoctorSchedule(id)
            toast.success('Schedule deleted')
            setList((prev) => prev.filter((x) => x.id !== id))
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Failed to delete schedule')
        } finally {
            setDeletingId(null)
        }
    }

    const hasDoctor = Boolean(doctorId)

    const summary = useMemo(
        () => `${list.length} weekday slot${list.length === 1 ? '' : 's'} configured`,
        [list.length],
    )

    return (
        <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 md:px-6">
            <div className="mx-auto max-w-5xl space-y-6">
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">
                        OPD Scheduling
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                        Doctor OPD Schedules
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Configure weekday-wise OPD timings for each doctor. Duplicate weekday
                        entries are blocked to keep the roster clean.
                    </p>
                </div>

                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 pb-4">
                        <CardTitle className="flex items-center justify-between text-base font-semibold text-slate-900">
                            <span>Schedule Setup</span>
                            <span className="text-xs font-normal text-slate-500">{summary}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="grid gap-4 md:grid-cols-[2fr,1.5fr]">
                            <div className="space-y-3">
                                <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                    Doctor
                                </label>
                                <DoctorPicker value={doctorId} onChange={handleDoctorChange} />
                                {!doctorId && (
                                    <p className="mt-1 text-[11px] text-amber-600">
                                        Select a doctor to view and update OPD schedules.
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <CalendarDays className="h-3 w-3" />
                                        Weekday
                                    </label>
                                    <Select value={weekday} onValueChange={setWeekday}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select weekday" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {WEEKDAYS.map((d, i) => (
                                                <SelectItem key={i} value={String(i)}>
                                                    {d}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <Clock className="h-3 w-3" />
                                        Start
                                    </label>
                                    <Input
                                        type="time"
                                        value={start}
                                        onChange={(e) => setStart(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <Clock className="h-3 w-3" />
                                        End
                                    </label>
                                    <Input
                                        type="time"
                                        value={end}
                                        onChange={(e) => setEnd(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-[1fr,auto] md:items-end">
                            <div className="space-y-1.5 max-w-xs">
                                <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                    Slot duration (minutes)
                                </label>
                                <Input
                                    type="number"
                                    min={5}
                                    step={5}
                                    value={slotMinutes}
                                    onChange={(e) => setSlotMinutes(e.target.value)}
                                    className="h-9 text-sm"
                                />
                                <p className="mt-1 text-[11px] text-slate-400">
                                    Used when generating appointment slots (e.g., 10 / 15 / 20).
                                </p>
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    className="px-5"
                                    disabled={!hasDoctor || saving}
                                    onClick={add}
                                >
                                    {saving ? 'Saving…' : 'Add Weekday Slot'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 pb-3">
                        <CardTitle className="text-sm font-semibold text-slate-900">
                            Existing Schedules
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {loading && (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                                    >
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!loading && (!list || list.length === 0) && (
                            <p className="py-6 text-sm text-slate-500">
                                No schedules configured yet for this doctor.
                            </p>
                        )}

                        {!loading && list && list.length > 0 && (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {list.map((s) => (
                                    <div
                                        key={s.id}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="font-semibold text-slate-900">
                                                    {WEEKDAYS[s.weekday]} ·{' '}
                                                    {s.start_time?.slice(0, 5)}–
                                                    {s.end_time?.slice(0, 5)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                <Badge
                                                    variant="outline"
                                                    className="border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px]"
                                                >
                                                    Slot: {s.slot_minutes || 15} min
                                                </Badge>
                                                {s.location && (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px]"
                                                    >
                                                        {s.location}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                            onClick={() => remove(s.id)}
                                            disabled={deletingId === s.id}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
