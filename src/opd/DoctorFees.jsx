// frontend/src/opd/DoctorFees.jsx
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import DoctorPicker from './components/DoctorPicker'
import {
    listDoctorFees,
    upsertDoctorFee,
    deleteDoctorFee,
} from '../api/opd'

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { IndianRupee, Trash2 } from 'lucide-react'

export default function DoctorFees() {
    const [doctorId, setDoctorId] = useState(null)

    const [baseFee, setBaseFee] = useState('')
    const [followupFee, setFollowupFee] = useState('')
    const [currency] = useState('INR')

    const [currentFee, setCurrentFee] = useState(null)
    const [list, setList] = useState([])

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState(null)

    const handleDoctorChange = useCallback((id /*, meta */) => {
        setDoctorId(id || null)
    }, [])

    const load = useCallback(async () => {
        if (!doctorId) {
            setList([])
            setCurrentFee(null)
            setBaseFee('')
            setFollowupFee('')
            return
        }
        try {
            setLoading(true)
            const { data } = await listDoctorFees({ doctor_user_id: doctorId })
            const rows = data || []
            setList(rows)

            const row = rows[0] || null
            setCurrentFee(row || null)

            if (row) {
                setBaseFee(
                    row.base_fee !== null && row.base_fee !== undefined
                        ? String(row.base_fee)
                        : '',
                )
                setFollowupFee(
                    row.followup_fee !== null && row.followup_fee !== undefined
                        ? String(row.followup_fee)
                        : '',
                )
            } else {
                setBaseFee('')
                setFollowupFee('')
            }
        } catch (e) {
            console.error(e)
            toast.error('Failed to load consultation fees')
        } finally {
            setLoading(false)
        }
    }, [doctorId])

    useEffect(() => {
        load()
    }, [load])

    const save = async (e) => {
        e?.preventDefault?.()
        if (!doctorId) {
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
                doctor_user_id: doctorId,
                base_fee: Number(baseFee),
                currency,
            }

            if (followupFee && Number(followupFee) > 0) {
                payload.followup_fee = Number(followupFee)
            }

            if (currentFee?.id) {
                // Update existing
                await upsertDoctorFee({ ...payload, id: currentFee.id })
                toast.success('Consultation fee updated')
            } else {
                // Create new
                const { data } = await upsertDoctorFee(payload)
                toast.success('Consultation fee created')
                setCurrentFee(data)
            }

            load()
        } catch (err) {
            console.error(err)
            toast.error(err?.response?.data?.detail || 'Failed to save fee')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (row) => {
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

    const hasDoctor = Boolean(doctorId)

    return (
        <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 md:px-6">
            <div className="mx-auto max-w-5xl space-y-6">
                {/* Header */}
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">
                        Billing Masters
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                        Doctor Consultation Fees
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Configure standard consultation and follow-up fees for each doctor.
                        These values can be reused during OPD billing and auto-pricing.
                    </p>
                </div>

                {/* Configure form */}
                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 pb-4">
                        <CardTitle className="text-sm font-semibold text-slate-900">
                            Configure Fee
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="grid gap-4 md:grid-cols-[2fr,1.2fr,1.2fr] md:items-end">
                            {/* Doctor */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                    Doctor
                                </label>
                                <DoctorPicker value={doctorId} onChange={handleDoctorChange} />
                                {!doctorId && (
                                    <p className="mt-1 text-[11px] text-amber-600">
                                        Select a doctor to manage consultation fees.
                                    </p>
                                )}
                            </div>

                            {/* Base fee */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                    Base consultation fee ({currency})
                                </label>
                                <div className="flex items-center gap-1">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                                        <IndianRupee className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="50"
                                        value={baseFee}
                                        onChange={(e) => setBaseFee(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Follow-up fee */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                    Follow-up fee ({currency}) (optional)
                                </label>
                                <div className="flex items-center gap-1">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                                        <IndianRupee className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="50"
                                        value={followupFee}
                                        onChange={(e) => setFollowupFee(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    Used when visit is marked as a follow-up (if supported by billing rules).
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                type="button"
                                onClick={save}
                                disabled={!hasDoctor || saving}
                                className="px-5"
                            >
                                {saving ? 'Saving…' : currentFee ? 'Update Fee' : 'Save Fee'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Existing fees list */}
                <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 pb-3">
                        <CardTitle className="text-sm font-semibold text-slate-900">
                            Existing Fees
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {loading && (
                            <div className="space-y-2">
                                {[1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                                    >
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!loading && (!list || list.length === 0) && (
                            <p className="py-6 text-sm text-slate-500">
                                No consultation fee configured yet for this doctor.
                            </p>
                        )}

                        {!loading && list && list.length > 0 && (
                            <div className="space-y-2 text-sm">
                                {list.map((row) => (
                                    <div
                                        key={row.id}
                                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm md:flex-row md:items-center md:justify-between"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-slate-900">
                                                    {row.doctor_name || 'Selected doctor'}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px]"
                                                >
                                                    {row.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                Standard OPD consultation pricing used during billing.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right text-xs text-slate-600">
                                                <div className="font-semibold text-slate-900">
                                                    Base:&nbsp;
                                                    <span className="inline-flex items-center gap-1">
                                                        <IndianRupee className="h-3.5 w-3.5 text-slate-500" />
                                                        <span>{row.base_fee}</span>
                                                    </span>
                                                </div>
                                                <div>
                                                    Follow-up:&nbsp;
                                                    {row.followup_fee != null ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <IndianRupee className="h-3.5 w-3.5 text-slate-500" />
                                                            <span>{row.followup_fee}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">Not set</span>
                                                    )}
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                                onClick={() => remove(row)}
                                                disabled={deletingId === row.id}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
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
