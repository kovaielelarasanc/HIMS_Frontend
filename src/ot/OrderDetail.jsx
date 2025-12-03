import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getOtOrder, scheduleOtOrder, updateOtStatus, uploadOtAttachment, addOtAttachmentLink } from '../api/ot'
import { toast } from 'sonner'
import { CalendarClock, Check, Play, X, Paperclip, RefreshCw } from 'lucide-react'
import { useCan } from '../hooks/usePerm'
import PatientRef from '../components/PatientRef'
import API from '../api/client'

const fmtDT = (s) => {
    if (!s) return '—'
    try { return new Date(s).toLocaleString() } catch { return s }
}

const statusNextActions = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'planned') return ['scheduled', 'in_progress', 'cancelled']
    if (s === 'scheduled') return ['in_progress', 'cancelled']
    if (s === 'in_progress') return ['completed', 'cancelled']
    return []
}

export default function OtOrderDetail() {
    const { id } = useParams()
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const canUpdate = useCan('ot.cases.update')
    const canUpload = useCan('ot.cases.update') || useCan('ot.masters.manage')

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await getOtOrder(id)
            setOrder(data)
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to load order')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [id])

    useEffect(() => {
        try {
            const base = API.defaults.baseURL || ''
            const wsBase = base.replace(/^http/, 'ws')
            const ws = new WebSocket(`${wsBase}/ot/ws`)
            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data)
                    if (!msg?.type?.startsWith('ot.')) return
                    if (String(msg?.order_id) !== String(id)) return
                    load()
                } catch { /* ignore */ }
            }
            return () => ws.close()
        } catch { /* ignore */ }
    }, [id])

    const [schedStart, setSchedStart] = useState('')
    const [schedEnd, setSchedEnd] = useState('')
    const onSchedule = async () => {
        if (!schedStart) return toast.error('Start time required')
        setBusy(true)
        try {
            await scheduleOtOrder(id, { scheduled_start: schedStart, scheduled_end: schedEnd || null })
            toast.success('Scheduled')
            setSchedStart('')
            setSchedEnd('')
            await load()
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to schedule')
        } finally { setBusy(false) }
    }

    const doSetStatus = async (next) => {
        setBusy(true)
        try {
            await updateOtStatus(id, next)
            toast.success(`Status: ${next}`)
            await load()
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to update status')
        } finally { setBusy(false) }
    }

    const [note, setNote] = useState('')
    const fileRef = useRef(null)
    const onUpload = async (e) => {
        const f = e.target.files?.[0]
        if (!f) return
        setBusy(true)
        try {
            await uploadOtAttachment(id, f, note)
            toast.success('File uploaded')
            setNote('')
            fileRef.current.value = ''
            await load()
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Upload failed')
        } finally { setBusy(false) }
    }

    const [linkUrl, setLinkUrl] = useState('')
    const addLink = async () => {
        if (!linkUrl.trim()) return
        setBusy(true)
        try {
            await addOtAttachmentLink(id, { file_url: linkUrl.trim(), note })
            toast.success('Link added')
            setLinkUrl(''); setNote('')
            await load()
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to add link')
        } finally { setBusy(false) }
    }

    if (loading) return <div className="p-4">Loading…</div>
    if (!order) return <div className="p-4">Not found</div>

    const nexts = statusNextActions(order.status)

    return (
        <div className="p-4 space-y-6 text-black">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">OT Case #{order.id}</h1>
                    <div className="text-xs text-gray-500">
                        Patient: <PatientRef id={order.patient_id} /> · Created: {fmtDT(order.created_at)}
                    </div>
                    <div className="text-xs text-gray-500">
                        Surgery: <span className="font-medium">{order.surgery_name || '—'}</span> · Status: <span className="capitalize">{order.status}</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button className="btn-ghost" onClick={() => load()}>
                        <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                    </button>
                    {canUpdate && nexts.includes('scheduled') && (
                        <div className="flex items-center gap-2">
                            <input type="datetime-local" className="input" value={schedStart} onChange={e => setSchedStart(e.target.value)} />
                            <input type="datetime-local" className="input" value={schedEnd} onChange={e => setSchedEnd(e.target.value)} />
                            <button className="btn" disabled={busy} onClick={onSchedule}>
                                <CalendarClock className="h-4 w-4 mr-2" /> Schedule
                            </button>
                        </div>
                    )}
                    {canUpdate && nexts.includes('in_progress') && (
                        <button className="btn" disabled={busy} onClick={() => doSetStatus('in_progress')}>
                            <Play className="h-4 w-4 mr-2" /> Start
                        </button>
                    )}
                    {canUpdate && nexts.includes('completed') && (
                        <button className="btn" disabled={busy} onClick={() => doSetStatus('completed')}>
                            <Check className="h-4 w-4 mr-2" /> Complete
                        </button>
                    )}
                    {canUpdate && nexts.includes('cancelled') && (
                        <button className="btn-ghost" disabled={busy} onClick={() => doSetStatus('cancelled')}>
                            <X className="h-4 w-4 mr-2" /> Cancel
                        </button>
                    )}
                </div>
            </header>

            <section className="rounded-xl border bg-white p-4">
                <h3 className="font-medium mb-3">Timing</h3>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    <Item label="Scheduled Start" value={fmtDT(order.scheduled_start)} />
                    <Item label="Scheduled End" value={fmtDT(order.scheduled_end)} />
                    <Item label="Actual Start" value={fmtDT(order.actual_start)} />
                    <Item label="Actual End" value={fmtDT(order.actual_end)} />
                    <Item label="Updated" value={fmtDT(order.updated_at)} />
                </div>
            </section>

            <section className="rounded-xl border bg-white p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium">Attachments & Anaesthesia Records</h3>
                </div>

                {canUpload && (
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                            <input
                                type="file"
                                ref={fileRef}
                                className="input"
                                onChange={onUpload}
                                aria-label="Upload file"
                            />
                            <input
                                className="input"
                                placeholder="Note (e.g., Anaesthesia chart, Consent, OT notes)"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <input
                                className="input"
                                placeholder="or paste link (https://...)"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                            />
                            <button className="btn-ghost" disabled={busy} onClick={addLink}>
                                <Paperclip className="h-4 w-4 mr-2" /> Add Link
                            </button>
                        </div>
                    </div>
                )}

                <div className="rounded-lg border bg-gray-50">
                    <div className="p-3 text-sm text-gray-600">
                        Upload anaesthesia records, OT notes, scanned consent forms and other
                        reports. Images & PDFs can be previewed and downloaded for NABH audit.
                    </div>

                    {Array.isArray(order.attachments) && order.attachments.length > 0 ? (
                        <div className="divide-y border-t bg-white">
                            {order.attachments.map((att) => {
                                const url = att.file_url || att.url
                                const isImage =
                                    url && /\.(png|jpe?g|gif|webp)$/i.test(url)
                                const isPdf = url && /\.pdf(\?|$)/i.test(url)

                                return (
                                    <div
                                        key={att.id}
                                        className="p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium break-all">
                                                {att.note || 'Attachment'}
                                            </div>
                                            <div className="text-xs text-gray-500 break-all">
                                                {url}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                Added: {fmtDT(att.created_at)}
                                            </div>

                                            {isImage && (
                                                <div className="mt-2">
                                                    <img
                                                        src={url}
                                                        alt={att.note || 'attachment preview'}
                                                        className="max-h-32 rounded border"
                                                    />
                                                </div>
                                            )}

                                            {isPdf && (
                                                <div className="mt-2">
                                                    <iframe
                                                        src={url}
                                                        title="Attachment preview"
                                                        className="h-40 w-full rounded border"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 sm:flex-col md:flex-row sm:items-end sm:justify-end shrink-0">
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn-ghost text-xs"
                                            >
                                                Open
                                            </a>
                                            <a
                                                href={url}
                                                download
                                                className="btn text-xs"
                                            >
                                                Download
                                            </a>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="p-3 text-xs text-gray-400 border-t">
                            No attachments yet for this OT case.
                        </div>
                    )}
                </div>
            </section>


        </div>
    )
}

function Item({ label, value }) {
    return (
        <div className="rounded-lg border bg-gray-50 px-3 py-2">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-sm">{value || '—'}</div>
        </div>
    )
}
