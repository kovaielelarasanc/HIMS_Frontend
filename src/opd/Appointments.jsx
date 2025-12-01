// frontend/src/opd/AppointmentBooking.jsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
    createAppointment,
    listAppointments,
    getDoctorSlots,
} from '../api/opd'
import DoctorPicker from './components/DoctorPicker'
import PatientPicker from './components/PatientPicker'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import {
    CalendarDays,
    Clock,
    Stethoscope,
    User2,
    Activity,
    Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function AppointmentBooking() {
    const [date, setDate] = useState(todayStr())
    const [doctorId, setDoctorId] = useState(null)
    const [departmentId, setDepartmentId] = useState(null)
    const [patientId, setPatientId] = useState(null)
    const [purpose, setPurpose] = useState('Consultation')

    const [slots, setSlots] = useState([])
    const [selectedSlot, setSelectedSlot] = useState('')
    const [loadingSlots, setLoadingSlots] = useState(false)

    const [appointments, setAppointments] = useState([])
    const [loadingAppts, setLoadingAppts] = useState(false)

    const handleDoctorChange = (id, meta) => {
        setDoctorId(id)
        setDepartmentId(meta?.department_id || null)
        setSelectedSlot('')
    }

    const handlePatientChange = (id) => {
        setPatientId(id)
    }

    useEffect(() => {
        const loadSlotsAndAppts = async () => {
            if (!doctorId || !date) {
                setSlots([])
                setAppointments([])
                return
            }

            try {
                setLoadingSlots(true)
                const { data: slotData } = await getDoctorSlots({
                    doctorUserId: Number(doctorId),
                    date,
                    detailed: true,
                })
                const arr = Array.isArray(slotData)
                    ? slotData
                    : slotData?.slots || []
                setSlots(arr)
            } catch {
                setSlots([])
            } finally {
                setLoadingSlots(false)
            }

            try {
                setLoadingAppts(true)
                const { data: appts } = await listAppointments({
                    date,
                    doctor_id: Number(doctorId),
                })
                setAppointments(appts || [])
            } catch {
                setAppointments([])
            } finally {
                setLoadingAppts(false)
            }
        }

        loadSlotsAndAppts()
    }, [doctorId, date])

    const freeSlots = useMemo(
        () => slots.filter((s) => s.status === 'free' || !s.status),
        [slots],
    )

    const stats = useMemo(() => {
        const total = appointments.length
        const free = freeSlots.length
        const selected =
            selectedSlot ||
            (freeSlots[0]?.start ? `Earliest ${freeSlots[0].start}` : 'Not selected')
        return { total, free, selected }
    }, [appointments, freeSlots, selectedSlot])

    const book = async (e) => {
        e.preventDefault()
        if (!patientId) {
            toast.error('Please select a patient')
            return
        }
        if (!doctorId || !departmentId) {
            toast.error('Please select department & doctor')
            return
        }
        if (!selectedSlot) {
            toast.error('Please choose a time slot')
            return
        }
        try {
            await createAppointment({
                patient_id: patientId,
                department_id: departmentId,
                doctor_user_id: doctorId,
                date,
                slot_start: selectedSlot,
                purpose: purpose || 'Consultation',
            })
            toast.success('Appointment booked')
            setSelectedSlot('')

            const { data: appts } = await listAppointments({
                date,
                doctor_id: Number(doctorId),
            })
            setAppointments(appts || [])

            const { data: slotData } = await getDoctorSlots({
                doctorUserId: Number(doctorId),
                date,
                detailed: true,
            })
            const arr = Array.isArray(slotData)
                ? slotData
                : slotData?.slots || []
            setSlots(arr)
        } catch {
            // axios interceptor already shows error
        }
    }

    return (
        <div className="h-full w-full bg-[#eee] rounded">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
                {/* Page header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Live OPD · Booking & Queue</span>
                        </div>
                        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                            OPD Appointment Booking
                        </h1>
                        <p className="text-xs text-slate-500 sm:text-sm">
                            Quickly book patient appointments, view doctor schedule, and monitor today&apos;s queue.
                        </p>
                    </div>

                    {/* Quick stats */}
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
                                    Today&apos;s appointments
                                </p>
                                <p className="text-xl font-semibold text-slate-900">
                                    {stats.total}
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
                                    Free slots
                                </p>
                                <p className="text-xl font-semibold text-slate-900">
                                    {stats.free}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                <Clock className="h-5 w-5 text-slate-700" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    Selected time
                                </p>
                                <p className="text-sm font-semibold text-slate-900">
                                    {stats.selected}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                <Activity className="h-5 w-5 text-slate-700" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main layout */}
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr),minmax(0,1.4fr)] lg:gap-6">
                    {/* Booking form */}
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
                                    Book a new appointment
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500 sm:text-sm">
                                    Choose patient, doctor, date and slot. All fields are optimized for quick keyboard + mouse workflow.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <form onSubmit={book} className="space-y-4">
                                    {/* Patient & doctor pickers */}
                                    <div className="space-y-3">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                                            <div className="flex items-center gap-2 pb-2">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-slate-900 shadow-sm">
                                                    <User2 className="h-3 w-3" />
                                                </span>
                                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                    Patient details
                                                </span>
                                            </div>
                                            <div className="space-y-2 sm:space-y-3">
                                                <PatientPicker value={patientId} onChange={handlePatientChange} />
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                                            <div className="flex items-center gap-2 pb-2">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-slate-900 shadow-sm">
                                                    <Stethoscope className="h-3 w-3" />
                                                </span>
                                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                    Department & doctor
                                                </span>
                                            </div>
                                            <DoctorPicker value={doctorId} onChange={handleDoctorChange} />
                                        </div>
                                    </div>

                                    {/* Date & purpose */}
                                    <div className="grid gap-3 sm:grid-cols-2">
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
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-slate-600">
                                                Purpose
                                            </label>
                                            <Input
                                                value={purpose}
                                                onChange={(e) => setPurpose(e.target.value)}
                                                placeholder="Consultation / Review / Procedure…"
                                                className="h-9 rounded-2xl border-slate-200 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Slots */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <label className="text-xs font-medium text-slate-600">
                                                Time slot
                                            </label>
                                            <span className="text-[11px] text-slate-400">
                                                {freeSlots.length} free slot(s) available
                                            </span>
                                        </div>

                                        {loadingSlots ? (
                                            <div className="flex flex-wrap gap-2">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Skeleton
                                                        key={i}
                                                        className="h-7 w-16 rounded-full bg-slate-100"
                                                    />
                                                ))}
                                            </div>
                                        ) : freeSlots.length === 0 ? (
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                No free slots for this date / doctor. Choose another date or doctor.
                                            </div>
                                        ) : (
                                            <ScrollArea className="max-h-40 rounded-2xl border border-slate-100 bg-slate-50/80 px-2 py-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {freeSlots.map((s) => (
                                                        <button
                                                            key={s.start}
                                                            type="button"
                                                            onClick={() => setSelectedSlot(s.start)}
                                                            className={[
                                                                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition',
                                                                selectedSlot === s.start
                                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
                                                            ].join(' ')}
                                                        >
                                                            <Clock className="h-3 w-3" />
                                                            {s.start}–{s.end}
                                                        </button>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        )}
                                    </div>

                                    <Separator className="my-1" />

                                    {/* Action */}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-[11px] text-slate-400">
                                            Booking will immediately reflect in OPD queue & doctor view.
                                        </p>
                                        <Button
                                            type="submit"
                                            className="h-9 rounded-2xl bg-slate-900 px-4 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800 disabled:opacity-50"
                                            disabled={!patientId || !doctorId || !selectedSlot}
                                        >
                                            Book appointment
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Day list / mini queue */}
                    <motion.div
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
                                            <CalendarDays className="h-4 w-4 text-slate-600" />
                                            Appointments for the day
                                        </CardTitle>
                                        <CardDescription className="text-xs text-slate-500 sm:text-sm">
                                            See all appointments for the selected doctor and date.
                                        </CardDescription>
                                    </div>
                                    {(loadingAppts || loadingSlots) && (
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

                            <CardContent className="pb-3">
                                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                                    <span>
                                        {date} {doctorId ? `· Doctor ID ${doctorId}` : ''}
                                    </span>
                                    <span>{appointments.length} appointment(s)</span>
                                </div>

                                {loadingAppts ? (
                                    <div className="space-y-2">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <Skeleton
                                                key={i}
                                                className="h-14 w-full rounded-2xl bg-slate-100"
                                            />
                                        ))}
                                    </div>
                                ) : appointments.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                                        No appointments for this filter yet.
                                        <div className="mt-1 text-[11px] text-slate-400">
                                            Start by booking a new appointment on the left.
                                        </div>
                                    </div>
                                ) : (
                                    <ScrollArea className="max-h-[380px] pr-1">
                                        <div className="space-y-2 text-sm">
                                            <AnimatePresence initial={false}>
                                                {appointments.map((a) => (
                                                    <motion.div
                                                        key={a.id}
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -4 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 sm:flex-row sm:items-center sm:justify-between"
                                                    >
                                                        <div className="space-y-0.5">
                                                            <div className="flex flex-wrap items-center gap-1">
                                                                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-800 border border-slate-200">
                                                                    {a.slot_start}–{a.slot_end}
                                                                </span>
                                                                <span className="font-medium">
                                                                    {a.patient_name}
                                                                </span>
                                                                <span className="text-[11px] text-slate-500">
                                                                    (UHID {a.uhid})
                                                                </span>
                                                            </div>
                                                            <div className="text-[11px] text-slate-500">
                                                                {a.department_name} · {a.doctor_name}{' '}
                                                                <span className="ml-1 inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                                                    {a.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 sm:text-right">
                                                            {a.vitals_registered ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                                                                    <Activity className="h-3 w-3" />
                                                                    Vitals done
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                                                                    <Activity className="h-3 w-3" />
                                                                    No vitals yet
                                                                </span>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
