// frontend/src/opd/Triage.jsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchQueue, recordVitals } from '../api/opd'
import DoctorPicker from './components/DoctorPicker'

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

import {
    Activity,
    Stethoscope,
    HeartPulse,
    Thermometer,
    CalendarDays,
    User2,
    Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function Triage() {
    const [doctorId, setDoctorId] = useState(null)
    const [date, setDate] = useState(todayStr())
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [target, setTarget] = useState(null)
    const [form, setForm] = useState({
        height_cm: '',
        weight_kg: '',
        temp_c: '',
        pulse: '',
        resp_rate: '',
        spo2: '',
        bp_sys: '',
        bp_dia: '',
        notes: '',
    })
    const [saving, setSaving] = useState(false)

    const load = async () => {
        if (!doctorId || !date) {
            setRows([])
            return
        }
        try {
            setLoading(true)
            const { data } = await fetchQueue({
                doctor_user_id: Number(doctorId),
                for_date: date,
            })
            setRows(data || [])
        } catch {
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctorId, date])

    const handleDoctorChange = (id) => {
        setDoctorId(id)
    }

    const resetForm = () => ({
        height_cm: '',
        weight_kg: '',
        temp_c: '',
        pulse: '',
        resp_rate: '',
        spo2: '',
        bp_sys: '',
        bp_dia: '',
        notes: '',
    })

    const openVitals = (row) => {
        setTarget(row)
        setForm(resetForm())
        // Smooth scroll to the vitals form on small screens
        setTimeout(() => {
            const el = document.getElementById('triage-vitals-form')
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }, 80)
    }

    const saveVitals = async (e) => {
        e.preventDefault()
        if (!target) return
        try {
            setSaving(true)
            const payload = {
                appointment_id: target.appointment_id,
                height_cm: form.height_cm ? Number(form.height_cm) : undefined,
                weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
                temp_c: form.temp_c ? Number(form.temp_c) : undefined,
                pulse: form.pulse ? Number(form.pulse) : undefined,
                resp_rate: form.resp_rate ? Number(form.resp_rate) : undefined,
                spo2: form.spo2 ? Number(form.spo2) : undefined,
                bp_sys: form.bp_sys ? Number(form.bp_sys) : undefined,
                bp_dia: form.bp_dia ? Number(form.bp_dia) : undefined,
                notes: form.notes || undefined,
            }
            await recordVitals(payload)
            toast.success('Vitals recorded')
            setTarget(null)
            await load()
        } catch {
            // errors handled globally
        } finally {
            setSaving(false)
        }
    }

    const onField = (name, val) =>
        setForm((f) => ({
            ...f,
            [name]: val,
        }))

    const total = rows.length
    const completed = rows.filter((r) => r.has_vitals).length
    const pending = total - completed

    return (
        <div className="h-full w-full bg-slate-50">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
                {/* Page header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Live OPD · Triage &amp; Vitals</span>
                        </div>
                        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                            OPD Triage (Vitals)
                        </h1>
                        <p className="text-xs text-slate-500 sm:text-sm">
                            Nursing staff can quickly capture vitals for patients waiting in the doctor&apos;s queue.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Badge
                            variant="outline"
                            className="flex items-center gap-1 rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] font-normal text-slate-700 shadow-sm"
                        >
                            <CalendarDays className="h-3 w-3" />
                            {date}
                        </Badge>
                        {doctorId && (
                            <Badge
                                variant="outline"
                                className="flex items-center gap-1 rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] font-normal text-slate-700 shadow-sm"
                            >
                                <Stethoscope className="h-3 w-3" />
                                Doctor ID {doctorId}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Summary tiles */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    Queue size
                                </p>
                                <p className="text-xl font-semibold text-slate-900">
                                    {total}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                <User2 className="h-5 w-5 text-slate-700" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    Vitals completed
                                </p>
                                <p className="text-xl font-semibold text-slate-900">
                                    {completed}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                <Activity className="h-5 w-5 text-slate-700" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    Pending vitals
                                </p>
                                <p className="text-xl font-semibold text-slate-900">
                                    {pending}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                <HeartPulse className="h-5 w-5 text-slate-700" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main layout */}
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr),minmax(0,1.6fr)] lg:gap-6">
                    {/* Left: Doctor/date & queue */}
                    <motion.div
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900 sm:text-lg">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-2xl bg-slate-900 text-xs text-white">
                                        1
                                    </span>
                                    Select doctor &amp; view queue
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500 sm:text-sm">
                                    Pick the doctor and date to load today&apos;s OPD queue for triage.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="grid items-end gap-3 md:grid-cols-[2fr,1.3fr]">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                                        <div className="flex items-center gap-2 pb-2">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-slate-900 shadow-sm">
                                                <Stethoscope className="h-3 w-3" />
                                            </span>
                                            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                Doctor
                                            </span>
                                        </div>
                                        <DoctorPicker value={doctorId} onChange={handleDoctorChange} />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-600">
                                            Date
                                        </label>
                                        <Input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="h-9 rounded-2xl border-slate-200 text-sm"
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                                        <span>
                                            {doctorId ? 'Queue for selected doctor' : 'Select a doctor to load queue'}
                                        </span>
                                        <span>{total} patient(s)</span>
                                    </div>

                                    {loading ? (
                                        <div className="space-y-2 mt-1">
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <Skeleton
                                                    key={i}
                                                    className="h-14 w-full rounded-2xl bg-slate-100"
                                                />
                                            ))}
                                        </div>
                                    ) : rows.length === 0 ? (
                                        <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                                            No appointments for this doctor / date.
                                            <div className="mt-1 text-[11px] text-slate-400">
                                                Use the Appointment Booking screen to add new patients.
                                            </div>
                                        </div>
                                    ) : (
                                        <ScrollArea className="mt-1 max-h-[380px] pr-1">
                                            <div className="space-y-2 text-sm">
                                                <AnimatePresence initial={false}>
                                                    {rows.map((row) => (
                                                        <motion.div
                                                            key={row.appointment_id}
                                                            initial={{ opacity: 0, y: 4 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -4 }}
                                                            transition={{ duration: 0.15 }}
                                                            className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 sm:flex-row sm:items-center sm:justify-between"
                                                        >
                                                            <div className="space-y-0.5">
                                                                <div className="flex flex-wrap items-center gap-1">
                                                                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-800 border border-slate-200">
                                                                        {row.time}
                                                                    </span>
                                                                    <span className="font-medium">
                                                                        {row.patient.name}
                                                                    </span>
                                                                    <span className="text-[11px] text-slate-500">
                                                                        (UHID {row.patient.uhid})
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                                                                    <span>Vitals:</span>
                                                                    {row.has_vitals ? (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                                                                            <Activity className="h-3 w-3" />
                                                                            Already recorded
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                                                                            <Activity className="h-3 w-3" />
                                                                            Not recorded
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-end">
                                                                <Button
                                                                    type="button"
                                                                    variant={row.has_vitals ? 'outline' : 'default'}
                                                                    size="sm"
                                                                    className={`rounded-2xl text-[11px] px-3 ${row.has_vitals
                                                                            ? 'bg-white text-slate-800 border-slate-300'
                                                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                                                        }`}
                                                                    onClick={() => openVitals(row)}
                                                                >
                                                                    Record vitals
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        </ScrollArea>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Right: Vitals form */}
                    <motion.div
                        id="triage-vitals-form"
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.05 }}
                        className="lg:sticky lg:top-24"
                    >
                        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900 sm:text-lg">
                                            <HeartPulse className="h-4 w-4 text-slate-700" />
                                            Record patient vitals
                                        </CardTitle>
                                        <CardDescription className="text-xs text-slate-500 sm:text-sm">
                                            Select a patient from the queue to start capturing vitals.
                                        </CardDescription>
                                    </div>
                                    {(saving || loading) && (
                                        <Badge
                                            variant="outline"
                                            className="inline-flex items-center gap-1 rounded-full border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500"
                                        >
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Syncing
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="pb-4">
                                {!target ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                                        No patient selected.
                                        <div className="mt-1 text-[11px] text-slate-400">
                                            Click <span className="font-medium">“Record vitals”</span> on any patient in the queue to begin.
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={saveVitals} className="space-y-4">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
                                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-800 border border-slate-200">
                                                    <User2 className="h-3 w-3" />
                                                    {target.patient.name}
                                                </span>
                                                <span className="text-[11px] text-slate-500">
                                                    UHID {target.patient.uhid}
                                                </span>
                                                <span className="text-[11px] text-slate-500">
                                                    · Time {target.time}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Height, weight, temperature */}
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Height (cm)
                                                </label>
                                                <Input
                                                    value={form.height_cm}
                                                    onChange={(e) => onField('height_cm', e.target.value)}
                                                    className="h-9 rounded-2xl border-slate-200 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Weight (kg)
                                                </label>
                                                <Input
                                                    value={form.weight_kg}
                                                    onChange={(e) => onField('weight_kg', e.target.value)}
                                                    className="h-9 rounded-2xl border-slate-200 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                                                    Temperature (°C)
                                                    <Thermometer className="h-3 w-3 text-slate-500" />
                                                </label>
                                                <Input
                                                    value={form.temp_c}
                                                    onChange={(e) => onField('temp_c', e.target.value)}
                                                    className="h-9 rounded-2xl border-slate-200 text-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Pulse, resp, SpO2, BP */}
                                        <div className="grid gap-3 md:grid-cols-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Pulse (bpm)
                                                </label>
                                                <Input
                                                    value={form.pulse}
                                                    onChange={(e) => onField('pulse', e.target.value)}
                                                    className="h-9 rounded-2xl border-slate-200 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Resp. rate
                                                </label>
                                                <Input
                                                    value={form.resp_rate}
                                                    onChange={(e) => onField('resp_rate', e.target.value)}
                                                    className="h-9 rounded-2xl border-slate-200 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    SpO₂ (%)
                                                </label>
                                                <Input
                                                    value={form.spo2}
                                                    onChange={(e) => onField('spo2', e.target.value)}
                                                    className="h-9 rounded-2xl border-slate-200 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    BP (sys / dia)
                                                </label>
                                                <div className="flex gap-1.5">
                                                    <Input
                                                        value={form.bp_sys}
                                                        onChange={(e) => onField('bp_sys', e.target.value)}
                                                        placeholder="Sys"
                                                        className="h-9 rounded-2xl border-slate-200 text-sm"
                                                    />
                                                    <Input
                                                        value={form.bp_dia}
                                                        onChange={(e) => onField('bp_dia', e.target.value)}
                                                        placeholder="Dia"
                                                        className="h-9 rounded-2xl border-slate-200 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-slate-600">
                                                Notes
                                            </label>
                                            <Textarea
                                                value={form.notes}
                                                onChange={(e) => onField('notes', e.target.value)}
                                                className="min-h-[70px] rounded-2xl border-slate-200 text-sm"
                                                placeholder="Enter any triage notes, pain score, alerts…"
                                            />
                                        </div>

                                        <Separator />

                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-[11px] text-slate-400">
                                                Saved vitals will be visible in the doctor&apos;s EMR view for this visit.
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 rounded-2xl border-slate-300 bg-white text-[11px]"
                                                    onClick={() => setTarget(null)}
                                                    disabled={saving}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    size="sm"
                                                    className="h-9 rounded-2xl bg-slate-900 px-4 text-[11px] font-semibold uppercase tracking-wide text-white hover:bg-slate-800 disabled:opacity-50"
                                                    disabled={saving}
                                                >
                                                    {saving ? 'Saving…' : 'Save vitals'}
                                                </Button>
                                            </div>
                                        </div>
                                    </form>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
