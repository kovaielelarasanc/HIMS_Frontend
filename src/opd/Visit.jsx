// FILE: src/opd/Visit.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { fetchVisit, updateVisit, createFollowup } from '../api/opd'
import QuickOrders from '@/components/QuickOrders'

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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import {
    Activity,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    HeartPulse,
    Loader2,
    NotebookPen,
    Stethoscope,
    User2,
} from 'lucide-react'

function cx(...xs) {
    return xs.filter(Boolean).join(' ')
}

const UI = {
    page: 'min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-slate-50 via-white to-slate-50',
    glass:
        'rounded-3xl border border-black/50 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]',
    chip:
        'inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700',
    chipBtn:
        'inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-black/[0.03] active:scale-[0.99] transition disabled:opacity-60',
    input:
        'h-11 w-full rounded-2xl border border-black/50 bg-white/85 px-3 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500',
}

const TABS = [
    { key: 'orders', label: 'Quick Orders', icon: ClipboardList },
    { key: 'notes', label: 'Clinical Notes', icon: NotebookPen },
    { key: 'followup', label: 'Follow-Up', icon: CalendarDays },
]

function prettyDateTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
}

function VitalsPill({ label, value }) {
    if (value === null || value === undefined || value === '') return null
    return (
        <span className="inline-flex items-center rounded-full border border-black/50 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <span className="text-slate-500">{label}:</span>
            <span className="ml-1 tabular-nums text-slate-900">{value}</span>
        </span>
    )
}

export default function Visit({ currentUser }) {
    const { id } = useParams()
    const visitId = Number(id)

    const [activeTab, setActiveTab] = useState('orders')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [data, setData] = useState(null)
    const [form, setForm] = useState({
        chief_complaint: '',
        symptoms: '',
        soap_subjective: '',
        soap_objective: '',
        soap_assessment: '',
        plan: '',
    })

    const [fuDate, setFuDate] = useState('')
    const [fuNote, setFuNote] = useState('')
    const [fuSaving, setFuSaving] = useState(false)

    const load = async () => {
        try {
            setLoading(true)
            const { data } = await fetchVisit(visitId)
            setData(data)
            setForm({
                chief_complaint: data.chief_complaint || '',
                symptoms: data.symptoms || '',
                soap_subjective: data.soap_subjective || '',
                soap_objective: data.soap_objective || '',
                soap_assessment: data.soap_assessment || '',
                plan: data.plan || '',
            })
        } catch {
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!visitId) return
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitId])

    const onField = (name, val) => setForm((f) => ({ ...f, [name]: val }))

    const save = async () => {
        try {
            setSaving(true)
            await updateVisit(visitId, form)
            toast.success('Visit updated')
            await load()
        } catch {
            // handled globally
        } finally {
            setSaving(false)
        }
    }

    const createFu = async () => {
        if (!fuDate) return toast.error('Select follow-up date')
        try {
            setFuSaving(true)
            await createFollowup(visitId, { due_date: fuDate, note: fuNote || undefined })
            toast.success('Follow-up created')
            setFuDate('')
            setFuNote('')
            await load()
            setActiveTab('followup')
        } catch {
            // handled globally
        } finally {
            setFuSaving(false)
        }
    }

    // QuickOrders wiring (same as your current)
    const quickOrdersPatient = useMemo(() => {
        if (!data) return null
        return { id: data.patient_id, full_name: data.patient_name, uhid: data.uhid }
    }, [data])

    const quickOrdersOpNumber = useMemo(() => {
        if (!data) return undefined
        return data.episode_id
    }, [data])

    if (!visitId) return <div className="p-4 text-sm">Invalid visit ID.</div>

    return (
        <div className={UI.page}>
            <div className="mx-auto max-w-6xl px-4 py-6 space-y-4 md:px-8">
                {/* HERO */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cx(UI.glass, 'relative overflow-hidden')}
                >
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_60%)]" />
                    <div className="relative p-5 md:p-7">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="relative inline-flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    </span>
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                                        OPD Visit
                                    </span>
                                </div>

                                <div className="mt-3 flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                                        <Stethoscope className="h-5 w-5 text-slate-700" />
                                    </div>

                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                                            Visit Workspace
                                        </h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Quick orders, clinical notes and follow-up — in one clean screen.
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            {loading ? (
                                                <>
                                                    <span className={UI.chip}><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</span>
                                                </>
                                            ) : data ? (
                                                <>
                                                    <span className={UI.chip}>
                                                        <User2 className="h-3.5 w-3.5" />
                                                        {data.patient_name}
                                                        <span className="opacity-70">(UHID {data.uhid})</span>
                                                    </span>

                                                    <span className={UI.chip}>
                                                        <ClipboardList className="h-3.5 w-3.5" />
                                                        Episode <span className="ml-1 tabular-nums">{data.episode_id}</span>
                                                    </span>

                                                    <span className={UI.chip}>
                                                        <CalendarDays className="h-3.5 w-3.5" />
                                                        {prettyDateTime(data.visit_at)}
                                                    </span>

                                                    <span className={UI.chip}>
                                                        <Stethoscope className="h-3.5 w-3.5" />
                                                        {data.department_name} · Dr. {data.doctor_name}
                                                    </span>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
                                {activeTab === 'notes' ? (
                                    <button
                                        type="button"
                                        className={cx(UI.chipBtn, 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800')}
                                        onClick={save}
                                        disabled={saving || loading}
                                        title="Save clinical notes"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        Save notes
                                    </button>
                                ) : (
                                    <span className={UI.chip}>
                                        <Activity className="h-3.5 w-3.5" />
                                        Ready
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* vitals strip */}
                        {!loading && data?.current_vitals && (
                            <div className="mt-5 rounded-3xl border border-black/50 bg-white/70 backdrop-blur px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 inline-flex items-center gap-2">
                                        <HeartPulse className="h-4 w-4 text-slate-500" />
                                        Latest vitals
                                    </div>
                                    <Badge variant="outline" className="rounded-full border-black/50 bg-white/85 text-[11px] font-semibold">
                                        Live
                                    </Badge>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                    <VitalsPill label="Ht" value={data.current_vitals.height_cm ? `${data.current_vitals.height_cm} cm` : ''} />
                                    <VitalsPill label="Wt" value={data.current_vitals.weight_kg ? `${data.current_vitals.weight_kg} kg` : ''} />
                                    <VitalsPill label="Temp" value={data.current_vitals.temp_c ? `${data.current_vitals.temp_c} °C` : ''} />
                                    <VitalsPill
                                        label="BP"
                                        value={
                                            data.current_vitals.bp_systolic
                                                ? `${data.current_vitals.bp_systolic}/${data.current_vitals.bp_diastolic} mmHg`
                                                : ''
                                        }
                                    />
                                    <VitalsPill label="Pulse" value={data.current_vitals.pulse ?? ''} />
                                    <VitalsPill label="RR" value={data.current_vitals.rr ?? ''} />
                                    <VitalsPill label="SpO₂" value={data.current_vitals.spo2 ? `${data.current_vitals.spo2}%` : ''} />
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Tabs (sticky) */}
                <div className=" top-[4.25rem] z-20">
                    <div className={cx(UI.glass, 'px-3 py-2')}>
                        <div className="flex items-center gap-2 overflow-auto no-scrollbar">
                            {TABS.map((t) => {
                                const active = activeTab === t.key
                                const Icon = t.icon
                                return (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setActiveTab(t.key)}
                                        className={cx(
                                            'whitespace-nowrap inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-semibold transition',
                                            active
                                                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                                : 'border-black/50 bg-white/75 text-slate-700 hover:bg-black/[0.03]',
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {t.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading && (
                    <Card className={cx(UI.glass)}>
                        <CardContent className="pt-6 space-y-3">
                            <Skeleton className="h-6 w-56 rounded-2xl" />
                            <Skeleton className="h-4 w-[80%] rounded-2xl" />
                            <Skeleton className="h-40 w-full rounded-3xl" />
                        </CardContent>
                    </Card>
                )}

                {!loading && !data && (
                    <Card className={cx(UI.glass)}>
                        <CardContent className="pt-6 text-sm text-rose-700">Visit not found.</CardContent>
                    </Card>
                )}

                {!loading && data && (
                    <AnimatePresence mode="wait" initial={false}>
                        {/* QUICK ORDERS */}
                        {activeTab === 'orders' && (
                            <motion.div
                                key="orders"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">Quick Orders</CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Place lab / radiology / pharmacy orders quickly for this visit.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <QuickOrders
                                            patient={quickOrdersPatient}
                                            contextType="opd"
                                            contextId={visitId}
                                            opNumber={quickOrdersOpNumber}
                                            currentUser={currentUser}
                                            defaultLocationId={undefined}
                                        />
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* CLINICAL NOTES */}
                        {activeTab === 'notes' && (
                            <motion.div
                                key="notes"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">
                                            Clinical Notes (SOAP)
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Keep it short, structured and readable. Save anytime.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="pt-4 space-y-4">
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Chief complaint
                                                </label>
                                                <Textarea
                                                    value={form.chief_complaint}
                                                    onChange={(e) => onField('chief_complaint', e.target.value)}
                                                    className="min-h-[90px] rounded-3xl border-black/50 bg-white/85 text-[13px]"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Symptoms
                                                </label>
                                                <Textarea
                                                    value={form.symptoms}
                                                    onChange={(e) => onField('symptoms', e.target.value)}
                                                    className="min-h-[90px] rounded-3xl border-black/50 bg-white/85 text-[13px]"
                                                />
                                            </div>
                                        </div>

                                        <Separator className="bg-black/10" />

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Subjective
                                                </label>
                                                <Textarea
                                                    value={form.soap_subjective}
                                                    onChange={(e) => onField('soap_subjective', e.target.value)}
                                                    className="min-h-[130px] rounded-3xl border-black/50 bg-white/85 text-[13px]"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Objective
                                                </label>
                                                <Textarea
                                                    value={form.soap_objective}
                                                    onChange={(e) => onField('soap_objective', e.target.value)}
                                                    className="min-h-[130px] rounded-3xl border-black/50 bg-white/85 text-[13px]"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Assessment
                                                </label>
                                                <Textarea
                                                    value={form.soap_assessment}
                                                    onChange={(e) => onField('soap_assessment', e.target.value)}
                                                    className="min-h-[130px] rounded-3xl border-black/50 bg-white/85 text-[13px]"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Plan
                                                </label>
                                                <Textarea
                                                    value={form.plan}
                                                    onChange={(e) => onField('plan', e.target.value)}
                                                    className="min-h-[130px] rounded-3xl border-black/50 bg-white/85 text-[13px]"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 rounded-3xl border border-black/50 bg-white/70 px-4 py-3">
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <NotebookPen className="h-4 w-4 text-slate-500" />
                                                Tip: keep sentences short and add key negatives.
                                            </div>

                                            <Button
                                                type="button"
                                                className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                onClick={save}
                                                disabled={saving}
                                            >
                                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                Save notes
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* FOLLOW-UP */}
                        {activeTab === 'followup' && (
                            <motion.div
                                key="followup"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">Follow-Up</CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Create a follow-up reminder for continuity of care.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="pt-4 space-y-4">
                                        <div className="grid gap-3 md:grid-cols-[1fr,2fr,auto] md:items-end">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Follow-up date
                                                </label>
                                                <Input
                                                    type="date"
                                                    value={fuDate}
                                                    onChange={(e) => setFuDate(e.target.value)}
                                                    className="h-11 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Note
                                                </label>
                                                <Input
                                                    value={fuNote}
                                                    onChange={(e) => setFuNote(e.target.value)}
                                                    placeholder="Review in 2 weeks / discuss reports…"
                                                    className="h-11 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                                />
                                            </div>

                                            <Button
                                                type="button"
                                                className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6"
                                                onClick={createFu}
                                                disabled={fuSaving}
                                            >
                                                {fuSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
                                                Create
                                            </Button>
                                        </div>

                                        <div className="rounded-3xl border border-black/50 bg-white/70 px-4 py-3 text-[12px] text-slate-600 inline-flex items-center gap-2">
                                            <Stethoscope className="h-4 w-4 text-slate-500" />
                                            Follow-up will appear in OPD → Follow-ups module and can be scheduled into appointments.
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    )
}
