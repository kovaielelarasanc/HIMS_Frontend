// src/ris/OrderDetail.jsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
    getRisOrder, scheduleRisOrder, markScanned,
    saveRisReport, updateRisReport, approveRisReport,
    uploadRisAttachment, addRisAttachmentLink
} from '../api/ris'
import OrderBadge from '../components/OrderBadge'
import PatientBadge from '../components/PatientBadge'
import StatusBadge from '../components/StatusBadge'
import ModalityBadge from '../components/ModalityBadge'
import PermGate from '../components/PermGate'
import { toast } from 'sonner'
import { Check, Clock, Upload } from 'lucide-react'

const fmtDT = (x) => x ? new Date(x).toLocaleString() : '—'

export default function RisOrderDetail() {
    const { id } = useParams()
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)
    const [scheduledAt, setScheduledAt] = useState('')
    const [reportText, setReportText] = useState('')
    const [saving, setSaving] = useState(false)
    const [uploads, setUploads] = useState([]) // local list (backend doesn't return attachments on GET)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await getRisOrder(id)
            setOrder(data)
            setReportText(data?.report_text || '')
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load order')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

    const onSchedule = async () => {
        if (!scheduledAt) return toast.error('Pick a date & time')
        try {
            await scheduleRisOrder(order.id, { scheduled_at: scheduledAt })
            toast.success('Scheduled')
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to schedule')
        }
    }

    const onScan = async () => {
        try {
            await markScanned(order.id)
            toast.success('Marked scanned')
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to mark scanned')
        }
    }

    const onSaveReport = async () => {
        setSaving(true)
        try {
            if (order.status === 'reported' || order.status === 'approved') {
                await updateRisReport(order.id, { report_text: reportText })
            } else {
                await saveRisReport(order.id, { report_text: reportText })
            }
            toast.success('Report saved')
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to save report')
        } finally {
            setSaving(false)
        }
    }

    const onApprove = async () => {
        try {
            await approveRisReport(order.id)
            toast.success('Report approved')
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Approval failed')
        }
    }

    const onUpload = async (ev) => {
        const file = ev.target.files?.[0]
        if (!file) return
        try {
            const { data } = await uploadRisAttachment(order.id, file)
            setUploads((u) => [{ file_url: data?.file_url, note: file.name }, ...u])
            toast.success('Attachment uploaded')
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Upload failed')
        } finally {
            ev.target.value = ''
        }
    }

    const onAddLink = async () => {
        const file_url = prompt('Paste file URL')
        if (!file_url) return
        try {
            const { data } = await addRisAttachmentLink(order.id, file_url, 'Link')
            setUploads((u) => [{ file_url: data?.file_url || file_url, note: 'Link' }, ...u])
            toast.success('Attachment linked')
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Link failed')
        }
    }

    if (loading) return <div>Loading…</div>
    if (!order) return <div className="text-sm text-gray-500">Order not found</div>

    return (
        <div className="space-y-6 text-black">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">
                        Radiology Order <OrderBadge order={order} prefix="RAD" />
                    </h1>
                    <div className="text-xs text-gray-500">
                        Patient: <PatientBadge patientId={order.patient_id} /> · Created: {fmtDT(order.created_at)}
                    </div>
                    <div className="text-xs text-gray-500">
                        Modality: <ModalityBadge modality={order.modality} /> · Status: <StatusBadge status={order.status} />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <PermGate anyOf={['radiology.report.create']}>
                        <button className="btn" onClick={onSaveReport} disabled={saving}>
                            {saving ? 'Saving…' : 'Save Report'}
                        </button>
                    </PermGate>
                    <PermGate anyOf={['radiology.report.approve']}>
                        <button className="btn" onClick={onApprove}>
                            <Check className="h-4 w-4 mr-2" /> Approve
                        </button>
                    </PermGate>
                </div>
            </header>

            {/* Workflow */}
            <section className="rounded-2xl border bg-white p-4 space-y-4">
                <h2 className="text-sm font-semibold">Workflow</h2>
                <div className="grid gap-4 md:grid-cols-3">
                    {/* Schedule */}
                    <div className="rounded-xl border p-3">
                        <div className="flex items-center gap-2 font-medium"><Clock className="h-4 w-4" /> Schedule</div>
                        <div className="mt-2 space-y-2">
                            <input
                                type="datetime-local"
                                className="input w-full"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                            />
                            <PermGate anyOf={['radiology.schedule.manage']}>
                                <button className="btn w-full" onClick={onSchedule}>Book Slot</button>
                            </PermGate>
                            <div className="text-xs text-gray-500">
                                Current: {fmtDT(order.scheduled_at)}
                            </div>
                        </div>
                    </div>

                    {/* Scan */}
                    <div className="rounded-xl border p-3">
                        <div className="flex items-center gap-2 font-medium">Scan</div>
                        <div className="mt-2 grid gap-2">
                            <PermGate anyOf={['radiology.scan.update']}>
                                <button className="btn w-full" onClick={onScan}>Mark Scanned</button>
                            </PermGate>
                            <div className="text-xs text-gray-500">
                                Scanned: {fmtDT(order.scanned_at)}
                            </div>
                        </div>
                    </div>

                    {/* Attachments */}
                    <div className="rounded-xl border p-3">
                        <div className="flex items-center gap-2 font-medium"><Upload className="h-4 w-4" /> Attachments</div>
                        <div className="mt-2 grid gap-2">
                            <input type="file" onChange={onUpload} />
                            <button className="btn-ghost text-left" onClick={onAddLink}>Add link</button>
                            <div className="mt-2 space-y-1">
                                {uploads.map((a, i) => (
                                    <a key={i} href={a.file_url} className="text-xs text-blue-700 underline" target="_blank" rel="noreferrer">
                                        {a.note || a.file_url}
                                    </a>
                                ))}
                                {uploads.length === 0 && <div className="text-xs text-gray-500">No attachments (local list)</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Report */}
            <section className="rounded-2xl border bg-white p-4 space-y-3">
                <h2 className="text-sm font-semibold">Report</h2>
                <textarea
                    className="input min-h-[200px]"
                    placeholder="Enter radiology report text…"
                    value={reportText}
                    onChange={e => setReportText(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                    <div>Ordered: {fmtDT(order.created_at)}</div>
                    <div>Scheduled: {fmtDT(order.scheduled_at)}</div>
                    <div>Scanned: {fmtDT(order.scanned_at)}</div>
                    <div>Reported: {fmtDT(order.reported_at)}</div>
                    <div>Approved: {fmtDT(order.approved_at)}</div>
                </div>
            </section>
        </div>
    )
}
