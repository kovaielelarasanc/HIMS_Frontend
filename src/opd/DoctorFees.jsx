// FILE: frontend/src/opd/DoctorFees.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import DoctorPicker from './components/DoctorPicker'
import { useAuth } from '../store/authStore'
import { listDoctorFees, upsertDoctorFee, deleteDoctorFee } from '../api/opd'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

import {
    Activity,
    CheckCircle2,
    Clock,
    IndianRupee,
    Lock,
    RefreshCcw,
    Save,
    Search,
    Trash2,
    User2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
        'inline-flex items-center gap-2 rounded-full border bg-green-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:text-black hover:bg-black/[0.03] active:scale-[0.99] transition',
    input:
        'h-11 w-full rounded-2xl border border-black/50 bg-white/85 px-3 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500',
}

function StatCard({ label, value, icon: Icon, tone = 'slate' }) {
    const toneCls =
        tone === 'dark'
            ? 'bg-slate-900 text-white border-slate-900'
            : tone === 'emerald'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : tone === 'sky'
                    ? 'bg-sky-50 text-sky-900 border-sky-200'
                    : 'bg-white/80 text-slate-900 border-black/50'

    return (
        <div className={cx('rounded-3xl border px-4 py-3', toneCls)}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
                    <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">{value}</div>
                </div>
                {Icon ? (
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/50 bg-white/30">
                        <Icon className="h-5 w-5 opacity-80" />
                    </div>
                ) : null}
            </div>
        </div>
    )
}

export default function DoctorFees() {
    const { user } = useAuth() || {}

    const [doctorId, setDoctorId] = useState(null)
    const [doctorMeta, setDoctorMeta] = useState(null)

    const [baseFee, setBaseFee] = useState('')
    const [followupFee, setFollowupFee] = useState('')
    const [currency] = useState('INR')

    const [currentFee, setCurrentFee] = useState(null)
    const [list, setList] = useState([])

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [lastSyncAt, setLastSyncAt] = useState(null)

    // ✅ common toggle (anyone can click; it uses logged-in user.id)
    const [myOnly, setMyOnly] = useState(false)
    const prevDoctorRef = useRef({ id: null, meta: null })

    // optional realtime feel
    const [autoRefresh, setAutoRefresh] = useState(false)

    const hasDoctor = Boolean(myOnly ? user?.id : doctorId)

    const handleDoctorChange = useCallback((id, meta) => {
        if (myOnly) return
        setDoctorId(id || null)
        setDoctorMeta(meta || null)
    }, [myOnly])

    const load = useCallback(async () => {
        const effectiveDoctorId = myOnly ? user?.id : doctorId
        if (!effectiveDoctorId) {
            setList([])
            setCurrentFee(null)
            setBaseFee('')
            setFollowupFee('')
            return
        }

        try {
            setLoading(true)
            const { data } = await listDoctorFees({ doctor_user_id: Number(effectiveDoctorId) })
            const rows = Array.isArray(data) ? data : []
            setList(rows)

            const row = rows[0] || null
            setCurrentFee(row || null)

            if (row) {
                setBaseFee(row.base_fee != null ? String(row.base_fee) : '')
                setFollowupFee(row.followup_fee != null ? String(row.followup_fee) : '')
            } else {
                setBaseFee('')
                setFollowupFee('')
            }

            setLastSyncAt(new Date())
        } catch (e) {
            console.error(e)
            toast.error('Failed to load consultation fees')
        } finally {
            setLoading(false)
        }
    }, [doctorId, myOnly, user])

    useEffect(() => {
        load()
    }, [load])

    useEffect(() => {
        if (!autoRefresh) return
        if (!hasDoctor) return
        const t = setInterval(() => {
            // avoid spamming while saving/deleting
            if (!saving && !deletingId) load()
        }, 15000)
        return () => clearInterval(t)
    }, [autoRefresh, hasDoctor, saving, deletingId, load])

    const toggleMyOnly = () => {
        if (!user?.id) {
            toast.error('No logged-in user found')
            return
        }

        setMyOnly((v) => {
            const next = !v
            if (next) {
                prevDoctorRef.current = { id: doctorId, meta: doctorMeta }
                setDoctorId(user.id)
                setDoctorMeta((m) => m || { name: user?.name || user?.full_name || 'My profile' })
                toast.success('Opened my fee profile')
            } else {
                const prev = prevDoctorRef.current || {}
                setDoctorId(prev?.id || null)
                setDoctorMeta(prev?.meta || null)
                toast.success('Back to selected doctor')
            }
            return next
        })
    }

    const save = async (e) => {
        e?.preventDefault?.()

        const effectiveDoctorId = myOnly ? user?.id : doctorId
        if (!effectiveDoctorId) {
            toast.error('Select doctor first')
            return
        }
        if (!baseFee || Number(baseFee) <= 0) {
            toast.error('Enter a valid base consultation fee')
            return
        }

        try {
            setSaving(true)

            const payload = {
                doctor_user_id: Number(effectiveDoctorId),
                base_fee: Number(baseFee),
                currency,
            }

            if (followupFee && Number(followupFee) > 0) payload.followup_fee = Number(followupFee)

            if (currentFee?.id) {
                await upsertDoctorFee({ ...payload, id: currentFee.id })
                toast.success('Consultation fee updated')
            } else {
                const { data } = await upsertDoctorFee(payload)
                toast.success('Consultation fee created')
                setCurrentFee(data || null)
            }

            await load()
        } catch (err) {
            console.error(err)
            toast.error(err?.response?.data?.detail || 'Failed to save fee')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (row) => {
        if (!row?.id) return
        if (!window.confirm('Delete this consultation fee?')) return
        try {
            setDeletingId(row.id)
            await deleteDoctorFee(row.id)
            toast.success('Fee deleted')
            setList((prev) => prev.filter((x) => x.id !== row.id))
            if (currentFee?.id === row.id) {
                setCurrentFee(null)
                setBaseFee('')
                setFollowupFee('')
            }
        } catch (err) {
            console.error(err)
            toast.error(err?.response?.data?.detail || 'Failed to delete fee')
        } finally {
            setDeletingId(null)
        }
    }

    const filteredList = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        if (!q) return list
        return list.filter((r) => {
            const d = String(r.doctor_name || '').toLowerCase()
            return d.includes(q)
        })
    }, [list, searchTerm])

    const stats = useMemo(() => {
        const total = list.length
        const active = list.filter((x) => x.is_active !== false).length
        return { total, active }
    }, [list])

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
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_60%)]" />
                    <div className="relative p-5 md:p-7">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="relative inline-flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    </span>
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                                        Real-time Master
                                    </span>
                                </div>

                                <div className="mt-3 flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                                        <IndianRupee className="h-5 w-5 text-slate-700" />
                                    </div>

                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                                            Doctor Consultation Fees
                                        </h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Configure base and follow-up pricing — used across OPD billing & auto-pricing.
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className={UI.chip}>
                                                <Activity className="h-3.5 w-3.5" />
                                                Active <span className="ml-1 tabular-nums">{stats.active}</span>
                                            </span>

                                            {doctorMeta?.name ? (
                                                <span className={UI.chip}>
                                                    <User2 className="h-3.5 w-3.5" />
                                                    {doctorMeta.name}
                                                    {myOnly ? <span className="ml-1 opacity-70">(You)</span> : null}
                                                </span>
                                            ) : null}

                                            <button
                                                type="button"
                                                onClick={toggleMyOnly}
                                                className={cx(
                                                    UI.chipBtn,
                                                    myOnly && 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800',
                                                )}
                                                title="Open logged-in user profile"
                                            >
                                                {myOnly ? <Lock className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                                                My profile
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setAutoRefresh((v) => !v)}
                                                className={cx(
                                                    UI.chipBtn,
                                                    autoRefresh && 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800',
                                                )}
                                                title="Auto refresh every 15s"
                                                disabled={!hasDoctor}
                                            >
                                                <Activity className="h-4 w-4" />
                                                Auto refresh
                                            </button>

                                            {lastSyncAt && (
                                                <span className={UI.chip}>
                                                    <Clock className="h-3.5 w-3.5" />
                                                    Synced{' '}
                                                    <span className="ml-1 tabular-nums">
                                                        {lastSyncAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
                                <button
                                    type="button"
                                    onClick={load}
                                    className={UI.chipBtn}
                                    disabled={loading || !hasDoctor}
                                    title="Refresh"
                                >
                                    <RefreshCcw className={cx('h-4 w-4', loading && 'animate-spin')} />
                                    Refresh
                                </button>

                                <span className={UI.chip}>
                                    Total <span className="ml-1 tabular-nums">{stats.total}</span>
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard label="Configured rows" value={stats.total} icon={CheckCircle2} tone="dark" />
                            <StatCard label="Active rows" value={stats.active} icon={Activity} tone="emerald" />
                            <StatCard label="Currency" value={currency} icon={IndianRupee} tone="sky" />
                            <StatCard label="Mode" value={autoRefresh ? 'Live' : 'Manual'} icon={RefreshCcw} tone="slate" />
                        </div>
                    </div>
                </motion.div>

                {/* MASTER BODY */}
                <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
                    {/* CONFIGURE */}
                    <Card className={cx(UI.glass, 'overflow-hidden')}>
                        <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                            <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                                Configure Fee
                            </CardTitle>
                            <CardDescription className="text-[12px] text-slate-600">
                                Select doctor, enter fees, and save instantly.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="pt-4 space-y-4">
                            <div>
                                <div
                                    className={cx(
                                        'rounded-2xl border border-black/50 bg-white/85 px-3 py-2',
                                        myOnly && 'opacity-70 pointer-events-none',
                                    )}
                                    title={myOnly ? 'My profile ON (doctor locked)' : 'Select doctor'}
                                >
                                    <DoctorPicker value={doctorId} onChange={handleDoctorChange} autoSelectCurrentDoctor />
                                </div>

                                {!hasDoctor && (
                                    <p className="mt-2 text-[11px] text-amber-700 font-semibold">
                                        Select a doctor (or use “My profile”) to manage consultation fees.
                                    </p>
                                )}
                            </div>

                            <Separator className="bg-black/10" />

                            <form onSubmit={save} className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                            Base consultation fee ({currency})
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/50 bg-white/70">
                                                <IndianRupee className="h-4 w-4 text-slate-600" />
                                            </div>
                                            <Input
                                                type="number"
                                                min={0}
                                                step="50"
                                                value={baseFee}
                                                onChange={(e) => setBaseFee(e.target.value)}
                                                className="h-11 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                                placeholder="e.g. 500"
                                            />
                                        </div>
                                    </div>

                                    {/* <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                            Follow-up fee ({currency}) (optional)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/50 bg-white/70">
                                                <IndianRupee className="h-4 w-4 text-slate-600" />
                                            </div>
                                            <Input
                                                type="number"
                                                min={0}
                                                step="50"
                                                value={followupFee}
                                                onChange={(e) => setFollowupFee(e.target.value)}
                                                className="h-11 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                                placeholder="e.g. 300"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            Used when visit is treated as a follow-up in billing rules.
                                        </p>
                                    </div> */}
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="submit"
                                        disabled={!hasDoctor || saving}
                                        className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        {saving ? 'Saving…' : currentFee ? 'Update Fee' : 'Save Fee'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* LIST */}
                    <Card className={cx(UI.glass, 'overflow-hidden')}>
                        <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                                        Existing Fees
                                    </CardTitle>
                                    <CardDescription className="text-[12px] text-slate-600">
                                        Saved fee rows for the selected doctor.
                                    </CardDescription>
                                </div>

                                <Badge
                                    variant="outline"
                                    className="rounded-full border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                    Showing <span className="ml-1 tabular-nums">{filteredList.length}</span>
                                </Badge>
                            </div>

                            <div className="mt-3 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search doctor name…"
                                    className={cx(UI.input, 'pl-10')}
                                />
                            </div>
                        </CardHeader>

                        <CardContent className="pt-4">
                            {!hasDoctor && (
                                <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-6 py-10 text-center">
                                    <div className="text-sm font-semibold text-slate-900">No doctor selected</div>
                                    <p className="mt-1 text-[12px] text-slate-500">
                                        Pick a doctor to view existing fee rows.
                                    </p>
                                </div>
                            )}

                            {hasDoctor && loading && (
                                <div className="space-y-2">
                                    {[1, 2, 3].map((i) => (
                                        <div
                                            key={i}
                                            className="rounded-3xl border border-black/50 bg-white/70 backdrop-blur px-4 py-3"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex-1 space-y-2">
                                                    <Skeleton className="h-4 w-40 rounded-xl" />
                                                    <Skeleton className="h-3 w-64 rounded-xl" />
                                                </div>
                                                <Skeleton className="h-10 w-10 rounded-2xl" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {hasDoctor && !loading && filteredList.length === 0 && (
                                <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-6 py-10 text-center">
                                    <div className="text-sm font-semibold text-slate-900">No fee configured</div>
                                    <p className="mt-1 text-[12px] text-slate-500">
                                        Enter fees on the left and save.
                                    </p>
                                </div>
                            )}

                            {hasDoctor && !loading && filteredList.length > 0 && (
                                <ScrollArea className="max-h-[58vh] pr-1">
                                    <div className="space-y-2">
                                        <AnimatePresence initial={false}>
                                            {filteredList.map((row) => (
                                                <motion.div
                                                    key={row.id}
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    transition={{ duration: 0.14 }}
                                                    className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.08)]"
                                                >
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div className="truncate text-[14px] font-semibold text-slate-900">
                                                                    {row.doctor_name || doctorMeta?.name || 'Selected doctor'}
                                                                </div>
                                                                <span
                                                                    className={cx(
                                                                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                                                                        row.is_active === false
                                                                            ? 'border-slate-500 bg-slate-100 text-slate-600'
                                                                            : 'border-emerald-200 bg-emerald-50 text-emerald-800',
                                                                    )}
                                                                >
                                                                    {row.is_active === false ? 'Inactive' : 'Active'}
                                                                </span>
                                                            </div>

                                                            <div className="mt-1 text-[11px] text-slate-500">
                                                                Standard OPD consultation pricing used during billing.
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right text-xs text-slate-600">
                                                                <div className="font-semibold text-slate-900 border-b ">
                                                                    Base:&nbsp;
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <IndianRupee className="h-3.5 w-3.5 text-slate-500" />
                                                                        <span className="tabular-nums">{row.base_fee}</span>
                                                                    </span>
                                                                </div>
                                                                {/* <div>
                                                                    &nbsp;
                                                                    {row.followup_fee != null ? (
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <IndianRupee className="h-3.5 w-3.5 text-slate-500" />
                                                                            <span className="tabular-nums"></span>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400"></span>
                                                                    )}
                                                                </div> */}
                                                            </div>

                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-10 w-10 rounded-2xl text-slate-400 hover:text-rose-600"
                                                                onClick={() => remove(row)}
                                                                disabled={deletingId === row.id}
                                                                title="Delete fee row"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
