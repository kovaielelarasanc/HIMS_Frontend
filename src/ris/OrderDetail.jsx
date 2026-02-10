// FILE: src/ris/OrderDetail.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
    Download,
    ExternalLink,
    FileText,
    Image as ImageIcon,
    Music2,
    Trash2,
    Upload,
    Video,
    X,
    Save,
    Link2,
    CheckCircle2,
    ReceiptText,
    Lock,
} from 'lucide-react'

import PermGate from '../components/PermGate'
import OrderBadge from '../components/OrderBadge'
import PatientBadge from '../components/PatientBadge'
import StatusBadge from '../components/StatusBadge'
import ModalityBadge from '../components/ModalityBadge'

import {
    getRisOrder,
    listRisAttachments,
    uploadRisAttachment,
    addRisAttachmentLink,
    deleteRisAttachment,
    saveRisOrderNotes,
    finalizeRisOrder,
} from '../api/ris'


const fmtDT = (x) => (x ? new Date(x).toLocaleString() : '—')

function cx(...a) {
    return a.filter(Boolean).join(' ')
}

function fileNameFromUrl(u = '') {
    try {
        const clean = String(u).split('?')[0]
        const parts = clean.split('/')
        return decodeURIComponent(parts[parts.length - 1] || 'file')
    } catch {
        return 'file'
    }
}

function extOf(u = '') {
    const clean = String(u).split('?')[0].toLowerCase()
    const m = clean.match(/\.([a-z0-9]+)$/i)
    return m ? m[1] : ''
}

function kindOf(u = '', name = '') {
    const e = extOf(name || u)
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(e)) return 'image'
    if (['pdf'].includes(e)) return 'pdf'
    if (['mp4', 'mov', 'webm', 'mkv'].includes(e)) return 'video'
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(e)) return 'audio'
    return 'file'
}

function KindIcon({ kind }) {
    const cls = 'h-4 w-4'
    if (kind === 'image') return <ImageIcon className={cls} />
    if (kind === 'pdf') return <FileText className={cls} />
    if (kind === 'video') return <Video className={cls} />
    if (kind === 'audio') return <Music2 className={cls} />
    return <FileText className={cls} />
}

function GlassModal({ open, title, subtitle, onClose, children }) {
    if (!open) return null
    return (
        <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-3 backdrop-blur-xl md:items-center"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.()
            }}
        >
            <div className="w-full max-w-xl rounded-[28px] border border-white/50 bg-white/70 shadow-2xl ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl">
                <div className="flex items-start gap-3 border-b border-black/5 px-4 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <Link2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-slate-900">{title}</div>
                        {subtitle ? <div className="mt-0.5 text-[12px] text-slate-600">{subtitle}</div> : null}
                    </div>
                    <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/50 bg-white/70 text-slate-700 hover:bg-white"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    )
}

export default function RisOrderDetail() {
    const { id } = useParams()

    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)

    const [attachments, setAttachments] = useState([])
    const [attLoading, setAttLoading] = useState(true)

    // uploader
    const fileRef = useRef(null)
    const [pickedFiles, setPickedFiles] = useState([])
    const [uploadNote, setUploadNote] = useState('')
    const [uploading, setUploading] = useState(false)

    // link modal
    const [linkOpen, setLinkOpen] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')
    const [linkNote, setLinkNote] = useState('')
    const [linkSaving, setLinkSaving] = useState(false)

    // preview
    const [active, setActive] = useState(null)

    // notes
    const [notes, setNotes] = useState('')
    const [savingNotes, setSavingNotes] = useState(false)

    // finalize
    const [finalizing, setFinalizing] = useState(false)

    const isFinalized = String(order?.status || '').toLowerCase() === 'finalized'
    const invoiceId = order?.billing_invoice_id || order?.invoice_id || null
    const invoicePath = invoiceId ? `/billing/invoices/${invoiceId}` : null // adjust if your route differs

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await getRisOrder(id)
            setOrder((prev) => ({
                ...data,
                // keep invoice id in UI if your GET /order doesn't include it
                billing_invoice_id: data?.billing_invoice_id ?? prev?.billing_invoice_id,
                billing_status: data?.billing_status ?? prev?.billing_status,
            }))
            setNotes(data?.notes ?? data?.report_text ?? '')
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load order')
        } finally {
            setLoading(false)
        }
    }

    const loadAttachments = async () => {
        setAttLoading(true)
        try {
            const { data } = await listRisAttachments(id)
            const rows = Array.isArray(data) ? data : []
            setAttachments(rows)
            setActive((prev) => prev || rows[0] || null)
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load attachments')
        } finally {
            setAttLoading(false)
        }
    }

    useEffect(() => {
        ; (async () => {
            await Promise.all([load(), loadAttachments()])
        })()
        // eslint-disable-next-line
    }, [id])

    const counts = useMemo(() => {
        const total = attachments.length
        const imgs = attachments.filter((a) => {
            const nm = a?.note || fileNameFromUrl(a?.file_url)
            return kindOf(a?.file_url, nm) === 'image'
        }).length
        const pdfs = attachments.filter((a) => {
            const nm = a?.note || fileNameFromUrl(a?.file_url)
            return kindOf(a?.file_url, nm) === 'pdf'
        }).length
        return { total, imgs, pdfs }
    }, [attachments])

    const onPick = (ev) => {
        const files = Array.from(ev.target.files || [])
        setPickedFiles(files)
    }

    const uploadAll = async () => {
        if (isFinalized) return toast.error('Order is finalized. Upload disabled.')
        if (!pickedFiles.length) return toast.error('Choose file(s) first')
        if (!order?.id) return

        setUploading(true)
        try {
            for (const f of pickedFiles) {
                await uploadRisAttachment(order.id, f, uploadNote || f.name)
            }
            toast.success('Uploaded')
            setPickedFiles([])
            setUploadNote('')
            if (fileRef.current) fileRef.current.value = ''
            await loadAttachments()
        } catch (e) {
            console.error('RIS upload error:', e)
            toast.error(e?.response?.data?.detail || e?.message || 'Upload failed')
        } finally {
            setUploading(false)
        }
    }

    const addLink = async () => {
        if (isFinalized) return toast.error('Order is finalized. Add link disabled.')
        const u = String(linkUrl || '').trim()
        if (!u) return toast.error('Paste a file URL')
        if (!order?.id) return

        setLinkSaving(true)
        try {
            await addRisAttachmentLink(order.id, u, linkNote || 'Link')
            toast.success('Linked')
            setLinkOpen(false)
            setLinkUrl('')
            setLinkNote('')
            await loadAttachments()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Link failed')
        } finally {
            setLinkSaving(false)
        }
    }

    const removeAttachment = async (att) => {
        if (isFinalized) return toast.error('Order is finalized. Delete disabled.')
        if (!att?.id) return
        if (!window.confirm('Delete this attachment?')) return
        try {
            await deleteRisAttachment(att.id)
            toast.success('Deleted')
            setActive((cur) => (cur?.id === att.id ? null : cur))
            await loadAttachments()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    const saveNotes = async () => {
        if (!order?.id) return
        setSavingNotes(true)
        try {
            await saveRisOrderNotes(order.id, { notes })
            toast.success('Notes saved')
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to save notes')
        } finally {
            setSavingNotes(false)
        }
    }

    const finalizeNow = async () => {
        if (!order?.id) return
        if (isFinalized) return toast.message('Already finalized')
        if (!window.confirm('Finalize this order and auto-create billing invoice?')) return

        setFinalizing(true)
        try {
            const { data } = await finalizeRisOrder(order.id)

            setOrder((prev) => ({
                ...prev,
                status: data?.status || 'finalized',
                billing_status: data?.billing_status ?? prev?.billing_status,
                billing_invoice_id: data?.invoice_id ?? prev?.billing_invoice_id,
            }))

            toast.success('Finalized + billed')
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Finalize failed')
        } finally {
            setFinalizing(false)
        }
    }

    if (loading) return <div className="text-sm text-slate-600">Loading…</div>
    if (!order) return <div className="text-sm text-slate-600">Order not found</div>

    const activeUrl = active?.file_url
    const activeName = active?.note || fileNameFromUrl(activeUrl)
    const activeKind = kindOf(activeUrl, activeName)

    return (
        <div className="text-slate-900">
            <div className="relative overflow-hidden rounded-[28px] border border-slate-500 bg-slate-50 p-3 md:p-5">
                {/* soft background glow */}
                <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[820px] -translate-x-1/2 rounded-full bg-sky-200/40 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 right-10 h-72 w-72 rounded-full bg-purple-200/30 blur-3xl" />

                {/* header */}
                <div className="rounded-[26px] border border-white/60 bg-white/70 p-4 shadow-sm ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-[16px] font-semibold tracking-tight md:text-[18px]">
                                Radiology Order <OrderBadge order={order} prefix="RAD" />
                            </h1>

                            <div className="mt-1 text-[12px] text-slate-600">
                                Patient: <PatientBadge patientId={order.patient_id} /> · Created: {fmtDT(order.created_at)}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
                                <span>
                                    Modality: <ModalityBadge modality={order.modality} />
                                </span>
                                <span>·</span>
                                <span>
                                    Status: <StatusBadge status={order.status} />
                                </span>

                                {isFinalized ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                                        <Lock className="h-3.5 w-3.5" /> Finalized
                                    </span>
                                ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                <span className="rounded-full border border-slate-500 bg-slate-50 px-3 py-1.5">
                                    Files: <b>{counts.total}</b>
                                </span>
                                <span className="rounded-full border border-slate-500 bg-slate-50 px-3 py-1.5">
                                    Images: <b>{counts.imgs}</b>
                                </span>
                                <span className="rounded-full border border-slate-500 bg-slate-50 px-3 py-1.5">
                                    PDFs: <b>{counts.pdfs}</b>
                                </span>
                            </div>
                        </div>

                        {/* actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* View Invoice (shows after finalize if invoice_id exists in state) */}
                            {invoicePath ? (
                                <Link
                                    to={invoicePath}
                                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-black/50 bg-white/70 px-4 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                    title="Open invoice"
                                >
                                    <ReceiptText className="h-4 w-4" />
                                    View Invoice
                                </Link>
                            ) : null}

                            {/* Finalize */}
                            <PermGate
                                anyOf={[
                                    'billing.invoices.create',
                                    'radiology.report.create',
                                    'radiology.report.approve',
                                ]}
                            >
                                {!isFinalized && (
                                    <button
                                        type="button"
                                        onClick={finalizeNow}
                                        disabled={finalizing}
                                        className="inline-flex h-10 items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                                        title="Finalize order and create invoice"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        {finalizing ? 'Finalizing…' : 'Finalize'}
                                    </button>
                                )}
                            </PermGate>

                            {/* Save notes */}
                            <PermGate anyOf={['radiology.report.create', 'radiology.report.approve']}>
                                <button
                                    type="button"
                                    onClick={saveNotes}
                                    disabled={savingNotes}
                                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                                >
                                    <Save className="h-4 w-4" />
                                    {savingNotes ? 'Saving…' : 'Save notes'}
                                </button>
                            </PermGate>
                        </div>
                    </div>

                    {isFinalized ? (
                        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
                            This order is <b>finalized</b>. Attachments are locked.
                        </div>
                    ) : null}
                </div>

                {/* body */}
                <div className="mt-4 flex flex-col gap-3 md:flex-row">
                    {/* left */}
                    <div className="w-full md:w-[420px] md:shrink-0">
                        <div className="rounded-[26px] border border-white/60 bg-white/70 p-4 shadow-sm ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl">
                            <div className="flex items-center justify-between">
                                <div className="text-[14px] font-semibold">Attachments</div>

                                {!isFinalized ? (
                                    <PermGate anyOf={['radiology.attachments.add']}>
                                        <button
                                            type="button"
                                            className="inline-flex h-9 items-center gap-2 rounded-2xl border border-black/50 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                            onClick={() => setLinkOpen(true)}
                                        >
                                            <Link2 className="h-4 w-4" />
                                            Add link
                                        </button>
                                    </PermGate>
                                ) : null}
                            </div>

                            {/* uploader */}
                            {!isFinalized ? (
                                <PermGate anyOf={['radiology.attachments.add']}>
                                    <div className="mt-3 rounded-[22px] border border-black/50 bg-white/60 p-3">
                                        <div className="text-[12px] font-semibold text-slate-800">Upload any file</div>
                                        <p className="mt-0.5 text-[11px] text-slate-600">
                                            Images / PDF / DOCX / ZIP / DICOM export — anything. You can preview images & PDFs.
                                        </p>

                                        <div className="mt-3 flex flex-col gap-2">
                                            <input ref={fileRef} type="file" multiple onChange={onPick} className="w-full text-[12px]" />

                                            <input
                                                className="h-10 rounded-2xl border border-black/50 bg-white/70 px-3 text-[12px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60"
                                                placeholder="Note (optional) — e.g., “CT brain images”, “Referral letter”"
                                                value={uploadNote}
                                                onChange={(e) => setUploadNote(e.target.value)}
                                            />

                                            <button
                                                type="button"
                                                onClick={uploadAll}
                                                disabled={uploading || !pickedFiles.length}
                                                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-[12px] font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                                            >
                                                <Upload className="h-4 w-4" />
                                                {uploading ? 'Uploading…' : `Upload ${pickedFiles.length ? `(${pickedFiles.length})` : ''}`}
                                            </button>

                                            {!!pickedFiles.length && (
                                                <div className="text-[11px] text-slate-600">
                                                    Selected:{' '}
                                                    <span className="font-semibold text-slate-900">{pickedFiles.map((f) => f.name).join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </PermGate>
                            ) : null}

                            {/* list */}
                            <div className="mt-3">
                                {attLoading ? (
                                    <div className="text-[12px] text-slate-600">Loading attachments…</div>
                                ) : attachments.length === 0 ? (
                                    <div className="rounded-[22px] border border-dashed border-black/50 bg-white/40 p-6 text-center text-[12px] text-slate-600">
                                        No attachments yet.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {attachments.map((a) => {
                                            const name = a?.note || fileNameFromUrl(a?.file_url)
                                            const kind = kindOf(a?.file_url, name)
                                            const isActive = active?.id === a?.id

                                            return (
                                                <div
                                                    key={a.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => setActive(a)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') setActive(a)
                                                    }}
                                                    className={cx(
                                                        'flex w-full items-start gap-3 rounded-[22px] border p-3 text-left transition outline-none',
                                                        isActive
                                                            ? 'border-slate-900 bg-white shadow-sm'
                                                            : 'border-black/50 bg-white/60 hover:bg-white/80',
                                                    )}
                                                >
                                                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                                        <KindIcon kind={kind} />
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-[12px] font-semibold text-slate-900">{name}</div>
                                                        <div className="mt-0.5 text-[11px] text-slate-600">{a?.created_at ? fmtDT(a.created_at) : '—'}</div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <a
                                                            href={a.file_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-black/50 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                                            onClick={(e) => e.stopPropagation()}
                                                            title="Open"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>

                                                        <a
                                                            href={a.file_url}
                                                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-black/50 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                                            onClick={(e) => e.stopPropagation()}
                                                            download
                                                            title="Download"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </a>

                                                        {!isFinalized ? (
                                                            <PermGate anyOf={['radiology.attachments.add']}>
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex h-9 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 text-[12px] font-semibold text-rose-700 hover:bg-rose-100"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        removeAttachment(a)
                                                                    }}
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </PermGate>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* right */}
                    <div className="min-w-0 flex-1">
                        {/* preview */}
                        <div className="rounded-[26px] border border-white/60 bg-white/70 p-4 shadow-sm ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-[14px] font-semibold">Preview</div>
                                    <div className="mt-0.5 truncate text-[12px] text-slate-600">
                                        {active ? activeName || 'Selected file' : 'Select a file from the left'}
                                    </div>
                                </div>

                                {activeUrl ? (
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={activeUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex h-9 items-center gap-2 rounded-2xl border border-black/50 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Open
                                        </a>
                                        <a
                                            href={activeUrl}
                                            download
                                            className="inline-flex h-9 items-center gap-2 rounded-2xl bg-slate-900 px-3 text-[12px] font-semibold text-white shadow-sm hover:bg-slate-800"
                                        >
                                            <Download className="h-4 w-4" />
                                            Download
                                        </a>
                                    </div>
                                ) : null}
                            </div>

                            <div className="mt-3 overflow-hidden rounded-[22px] border border-black/50 bg-white/50">
                                {!activeUrl ? (
                                    <div className="p-10 text-center text-[12px] text-slate-600">Choose an attachment to preview.</div>
                                ) : activeKind === 'image' ? (
                                    <div className="p-3">
                                        <img src={activeUrl} alt={activeName} className="max-h-[520px] w-full rounded-2xl object-contain" />
                                    </div>
                                ) : activeKind === 'pdf' ? (
                                    <iframe title="PDF Preview" src={activeUrl} className="h-[520px] w-full" />
                                ) : activeKind === 'video' ? (
                                    <div className="p-3">
                                        <video src={activeUrl} controls className="max-h-[520px] w-full rounded-2xl" />
                                    </div>
                                ) : activeKind === 'audio' ? (
                                    <div className="p-4">
                                        <audio src={activeUrl} controls className="w-full" />
                                    </div>
                                ) : (
                                    <div className="p-10 text-center text-[12px] text-slate-600">
                                        Preview not available for this file type.
                                        <div className="mt-3 flex justify-center gap-2">
                                            <a
                                                href={activeUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex h-9 items-center gap-2 rounded-2xl border border-black/50 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                Open
                                            </a>
                                            <a
                                                href={activeUrl}
                                                download
                                                className="inline-flex h-9 items-center gap-2 rounded-2xl bg-slate-900 px-3 text-[12px] font-semibold text-white shadow-sm hover:bg-slate-800"
                                            >
                                                <Download className="h-4 w-4" />
                                                Download
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* notes */}
                        <div className="mt-3 rounded-[26px] border border-white/60 bg-white/70 p-4 shadow-sm ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl">
                            <div>
                                <div className="text-[14px] font-semibold">Notes (optional)</div>
                                <div className="mt-0.5 text-[12px] text-slate-600">Store extra instructions / remarks for this order.</div>
                            </div>

                            <textarea
                                className="mt-3 min-h-[140px] w-full rounded-[22px] border border-black/50 bg-white/70 p-3 text-[12px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60"
                                placeholder="Type notes… (optional)"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />

                            <PermGate anyOf={['radiology.report.create', 'radiology.report.approve']}>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={saveNotes}
                                        disabled={savingNotes}
                                        className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        <Save className="h-4 w-4" />
                                        {savingNotes ? 'Saving…' : 'Save notes'}
                                    </button>
                                </div>
                            </PermGate>
                        </div>
                    </div>
                </div>

                {/* Link modal */}
                <GlassModal
                    open={linkOpen}
                    title="Add attachment link"
                    subtitle="Paste a public file URL (S3 / Drive / PACS export link, etc.)"
                    onClose={() => setLinkOpen(false)}
                >
                    <div className="space-y-3">
                        <input
                            className="h-10 w-full rounded-2xl border border-black/50 bg-white/70 px-3 text-[12px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60"
                            placeholder="https://…"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                        />
                        <input
                            className="h-10 w-full rounded-2xl border border-black/50 bg-white/70 px-3 text-[12px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60"
                            placeholder="Note (optional) — e.g., “Old report PDF”"
                            value={linkNote}
                            onChange={(e) => setLinkNote(e.target.value)}
                        />

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                className="h-10 rounded-2xl border border-black/50 bg-white/70 px-4 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                onClick={() => setLinkOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={linkSaving}
                                className="h-10 rounded-2xl bg-slate-900 px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                                onClick={addLink}
                            >
                                {linkSaving ? 'Saving…' : 'Add link'}
                            </button>
                        </div>
                    </div>
                </GlassModal>
            </div>
        </div>
    )
}
