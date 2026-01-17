// FILE: src/patients/PatientDetailDrawer.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import API from '../api/client'
import {
    getPatient,
    listPatientDocuments,
    listPatientConsents,
    uploadPatientDocument,
    createPatientConsent,
    openPatientPrintWindow,
    listPatientAuditLogs,
} from '../api/patients'

import {
    X,
    User,
    Printer,
    RefreshCcw,
    FileText,
    Upload,
    Download,
    Image as ImageIcon,
    ShieldCheck,
    Activity,
    Inbox,
    MapPin,
    Phone,
    Mail,
} from 'lucide-react'
import { formatIST } from '@/ipd/components/timeZONE'

/* -------------------- small utils -------------------- */
function safe(val) {
    if (val === null || val === undefined) return '—'
    if (val === true) return 'Yes'
    if (val === false) return 'No'
    const s = String(val).trim()
    return s ? s : '—'
}

function formatRefSource(code) {
    if (!code) return '—'
    const c = String(code).trim().toLowerCase()
    const map = {
        doctor: 'Doctor',
        google: 'Google',
        social_media: 'Social Media',
        socialmedia: 'Social Media',
        ads: 'Advertisements',
        other: 'Other',
        walkin: 'Walk-in',
        walk_in: 'Walk-in',
    }
    return map[c] || code
}

function formatBytes(size) {
    const n = Number(size)
    if (!n || Number.isNaN(n)) return '—'
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/* -------------------- audit helpers -------------------- */
function formatAuditValue(value) {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return '—'
        return trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    try {
        const json = JSON.stringify(value)
        return json.length > 28 ? `${json.slice(0, 28)}…` : json
    } catch {
        return '—'
    }
}

function getAuditChanges(log) {
    const oldVals = log?.old_values || {}
    const newVals = log?.new_values || {}
    const keys = Array.from(new Set([...Object.keys(oldVals || {}), ...Object.keys(newVals || {})]))
    const changes = []

    for (const key of keys) {
        const before = oldVals ? oldVals[key] : undefined
        const after = newVals ? newVals[key] : undefined
        const beforeStr = before === undefined ? undefined : JSON.stringify(before)
        const afterStr = after === undefined ? undefined : JSON.stringify(after)
        if (beforeStr !== afterStr) changes.push({ field: key, before, after })
    }
    return changes
}

/* -------------------- UI primitives -------------------- */
function IconButton({ title, onClick, disabled, children }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
            className={[
                'inline-flex h-9 w-9 items-center justify-center rounded-xl',
                'border border-black/50 bg-white/80 backdrop-blur',
                'text-slate-700 hover:bg-white active:scale-[0.98] transition',
                disabled ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
        >
            {children}
        </button>
    )
}

function SegTab({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'px-3 py-1.5 text-[12px] font-medium rounded-full transition whitespace-nowrap',
                active ? 'bg-slate-900 text-white shadow-sm' : 'bg-transparent text-slate-600 hover:bg-black/[0.04]',
            ].join(' ')}
        >
            {children}
        </button>
    )
}

function Card({ title, icon, right, children }) {
    return (
        <section className="rounded-2xl border border-black/50 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-400">{icon}</span>
                    <h3 className="text-[13px] font-semibold text-slate-900 tracking-tight truncate">{title}</h3>
                </div>
                {right}
            </div>
            <div className="px-4 pb-4">{children}</div>
        </section>
    )
}

function KV({ label, value, icon }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2">
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
                {icon ? <span className="text-slate-400">{icon}</span> : null}
                <span>{label}</span>
            </div>
            <div className="text-[12px] font-medium text-slate-900 text-right break-words">{safe(value)}</div>
        </div>
    )
}

/* -------------------- component -------------------- */
export default function PatientDetailDrawer({ open, onClose, patient, onUpdated }) {
    const [tab, setTab] = useState('overview') // overview | attachments | consents | activity

    const [fullPatient, setFullPatient] = useState(null)
    const [docs, setDocs] = useState([])
    const [consents, setConsents] = useState([])
    const [auditLogs, setAuditLogs] = useState([])

    const [loading, setLoading] = useState(false)
    const [auditLoading, setAuditLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [savingConsent, setSavingConsent] = useState(false)
    const [error, setError] = useState('')

    const [newDocFile, setNewDocFile] = useState(null)
    const [newDocType, setNewDocType] = useState('other')
    const [newConsentType, setNewConsentType] = useState('')
    const [newConsentText, setNewConsentText] = useState('')

    // Preview modal
    const [previewDoc, setPreviewDoc] = useState(null)
    const [previewUrl, setPreviewUrl] = useState('')
    const [previewType, setPreviewType] = useState('')

    // ✅ prevent nonstop loop
    const onUpdatedRef = useRef(onUpdated)
    useEffect(() => {
        onUpdatedRef.current = onUpdated
    }, [onUpdated])

    const loadedIdRef = useRef(null)
    const reqSeqRef = useRef(0)

    const p = fullPatient || patient
    const primaryAddress = (p?.addresses && p.addresses[0]) || null
    const ageText = p?.age_text || ''
    const isPregnant = !!p?.is_pregnant
    const rchId = p?.rch_id || ''

    const addressText = useMemo(() => {
        if (!primaryAddress) return '—'
        const lines = [
            primaryAddress.line1,
            primaryAddress.line2,
            [primaryAddress.city, primaryAddress.state, primaryAddress.pincode].filter(Boolean).join(', '),
            primaryAddress.country,
        ].filter(Boolean)
        return lines.join('\n')
    }, [primaryAddress])

    const closePreview = () => {
        try {
            if (previewUrl) URL.revokeObjectURL(previewUrl)
        } catch {
            // ignore
        }
        setPreviewDoc(null)
        setPreviewUrl('')
        setPreviewType('')
    }

    const isImage =
        previewDoc &&
        (previewType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(previewDoc.filename || ''))

    const isPdf = previewDoc && (previewType === 'application/pdf' || /\.pdf$/i.test(previewDoc.filename || ''))

    const loadAll = async (id, { silent = false } = {}) => {
        if (!id) return
        const seq = ++reqSeqRef.current

        if (!silent) setLoading(true)
        setError('')

        try {
            const [pRes, dRes, cRes] = await Promise.all([
                getPatient(id),
                listPatientDocuments(id),
                listPatientConsents(id),
            ])

            // ignore stale responses
            if (seq !== reqSeqRef.current) return

            setFullPatient(pRes.data)
            setDocs(dRes.data || [])
            setConsents(cRes.data || [])
            onUpdatedRef.current?.(pRes.data)
        } catch (err) {
            if (seq !== reqSeqRef.current) return
            setError(err?.response?.data?.detail || err?.message || 'Failed to load patient details')
        } finally {
            if (seq === reqSeqRef.current && !silent) setLoading(false)
        }

        // audit (non-blocking)
        setAuditLoading(true)
        try {
            const res = await listPatientAuditLogs(id, { limit: 30 })
            if (seq !== reqSeqRef.current) return
            setAuditLogs(res.data || [])
        } catch {
            // ignore
        } finally {
            if (seq === reqSeqRef.current) setAuditLoading(false)
        }
    }

    // ✅ only load when open + patient id changes (NOT when parent rerenders)
    useEffect(() => {
        if (!open || !patient?.id) return
        if (loadedIdRef.current === patient.id) return
        loadedIdRef.current = patient.id
        loadAll(patient.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, patient?.id])

    // reset when closing
    useEffect(() => {
        if (open) return
        reqSeqRef.current += 1
        loadedIdRef.current = null
        setTab('overview')
        setFullPatient(null)
        setDocs([])
        setConsents([])
        setAuditLogs([])
        setLoading(false)
        setAuditLoading(false)
        setUploading(false)
        setSavingConsent(false)
        setError('')
        setNewDocFile(null)
        setNewDocType('other')
        setNewConsentType('')
        setNewConsentText('')
        closePreview()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    // ESC close
    useEffect(() => {
        if (!open) return
        const onKey = (e) => e.key === 'Escape' && onClose?.()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open || !patient) return null

    const handleRefresh = async () => {
        if (!patient?.id) return
        await loadAll(patient.id, { silent: false })
    }

    const handlePrint = async () => {
        setError('')
        try {
            await openPatientPrintWindow(p.id)
        } catch (err) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to open print view')
        }
    }

    const handleUploadDoc = async (e) => {
        e.preventDefault()
        if (!newDocFile) return
        setUploading(true)
        setError('')
        try {
            const res = await uploadPatientDocument(p.id, { type: newDocType, file: newDocFile })
            setDocs((prev) => [res.data, ...prev])
            setNewDocFile(null)
            setNewDocType('other')
            setTab('attachments')
        } catch (err) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to upload document')
        } finally {
            setUploading(false)
        }
    }

    const handleCreateConsent = async (e) => {
        e.preventDefault()
        if (!newConsentType || !newConsentText) return
        setSavingConsent(true)
        setError('')
        try {
            const res = await createPatientConsent(p.id, { type: newConsentType, text: newConsentText })
            setConsents((prev) => [res.data, ...prev])
            setNewConsentType('')
            setNewConsentText('')
            setTab('consents')
        } catch (err) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to save consent')
        } finally {
            setSavingConsent(false)
        }
    }

    const openPreview = async (doc) => {
        setError('')
        try {
            const res = await API.get(`/patients/documents/${doc.id}/file`, { responseType: 'blob' })
            const blob = res.data
            const contentType =
                res.headers?.['content-type'] ||
                doc.mime ||
                doc.content_type ||
                doc.mime_type ||
                'application/octet-stream'

            const typedBlob = new Blob([blob], { type: contentType })
            const url = URL.createObjectURL(typedBlob)

            // cleanup previous url (if any) before replacing
            try {
                if (previewUrl) URL.revokeObjectURL(previewUrl)
            } catch {
                // ignore
            }

            setPreviewDoc(doc)
            setPreviewUrl(url)
            setPreviewType(contentType)
        } catch (err) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to load attachment for preview')
        }
    }

    const handleDownload = async (doc) => {
        setError('')
        try {
            const res = await API.get(`/patients/documents/${doc.id}/file`, { responseType: 'blob' })
            const blob = res.data
            const contentType =
                res.headers?.['content-type'] ||
                doc.mime ||
                doc.content_type ||
                doc.mime_type ||
                'application/octet-stream'
            const url = URL.createObjectURL(new Blob([blob], { type: contentType }))
            const a = document.createElement('a')
            a.href = url
            a.download = doc.filename || 'document'
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (err) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to download attachment')
        }
    }

    return (
        <div className="fixed inset-0 z-50">
            {/* overlay */}
            <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />

            {/* drawer */}
            <div
                className={[
                    'absolute inset-y-0 right-0',
                    'w-full sm:w-[560px] lg:w-[760px] max-w-[92vw]',
                    'bg-white shadow-2xl border-l border-black/50',
                    'flex flex-col',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
            >
                {/* top bar */}
                <div className="sticky top-0 z-10 border-b border-black/50 bg-white/85 backdrop-blur-xl">
                    <div className="px-4 pt-4 pb-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="h-10 w-10 rounded-2xl border border-black/50 bg-slate-50 grid place-items-center">
                                        <User className="h-4 w-4 text-slate-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-[15px] font-semibold text-slate-900 tracking-tight">
                                            {p?.first_name} {p?.last_name || ''}
                                        </div>
                                        <div className="truncate text-[12px] text-slate-500">
                                            UHID: <span className="font-mono">{safe(p?.uhid)}</span>
                                            {ageText ? ` • Age: ${ageText}` : ''}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {p?.patient_type ? (
                                        <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                            {p.patient_type}
                                        </span>
                                    ) : null}
                                    {p?.tag ? (
                                        <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                            {p.tag}
                                        </span>
                                    ) : null}

                                    {/* ✅ Pregnancy / RCH chips */}
                                    {isPregnant ? (
                                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 border border-rose-200">
                                            Pregnant
                                        </span>
                                    ) : null}
                                    {rchId ? (
                                        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-black/10">
                                            RCH: <span className="ml-1 font-mono">{rchId}</span>
                                        </span>
                                    ) : null}

                                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                        Audit-ready
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <IconButton title="Refresh" onClick={handleRefresh} disabled={loading}>
                                    <RefreshCcw className={['h-4 w-4', loading ? 'animate-spin' : ''].join(' ')} />
                                </IconButton>
                                <IconButton title="Print" onClick={handlePrint}>
                                    <Printer className="h-4 w-4" />
                                </IconButton>
                                <IconButton title="Close" onClick={onClose}>
                                    <X className="h-4 w-4" />
                                </IconButton>
                            </div>
                        </div>

                        {/* segmented tabs */}
                        <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-black/50 bg-black/[0.03] p-1 overflow-x-auto max-w-full">
                            <SegTab active={tab === 'overview'} onClick={() => setTab('overview')}>
                                Overview
                            </SegTab>
                            <SegTab active={tab === 'attachments'} onClick={() => setTab('attachments')}>
                                Attachments
                            </SegTab>
                            <SegTab active={tab === 'consents'} onClick={() => setTab('consents')}>
                                Consents
                            </SegTab>
                            <SegTab active={tab === 'activity'} onClick={() => setTab('activity')}>
                                Activity
                            </SegTab>
                        </div>

                        {error ? (
                            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                                {error}
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* content */}
                <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 space-y-4">
                    {loading ? (
                        <div className="rounded-2xl border border-black/50 bg-white px-4 py-3 text-[12px] text-slate-500">
                            Loading…
                        </div>
                    ) : null}

                    {tab === 'overview' && (
                        <>
                            <Card title="Patient" icon={<FileText className="h-4 w-4" />}>
                                <div className="divide-y divide-black/5">
                                    <KV label="Gender" value={p?.gender} />
                                    <KV label="DOB" value={p?.dob} />
                                    <KV label="Marital Status" value={p?.marital_status} />
                                    <KV label="Blood Group" value={p?.blood_group} />
                                    <KV label="Religion" value={p?.religion} />
                                    <KV label="Occupation" value={p?.occupation} />
                                </div>
                            </Card>

                            {/* ✅ Maternal / RCH card (only if used) */}
                            {isPregnant || rchId ? (
                                <Card title="Maternal / RCH" icon={<ShieldCheck className="h-4 w-4" />}>
                                    <div className="divide-y divide-black/5">
                                        <KV label="Pregnant" value={isPregnant} />
                                        <KV label="RCH ID (Govt)" value={rchId || '—'} />
                                    </div>
                                </Card>
                            ) : null}

                            <Card title="Contact" icon={<Phone className="h-4 w-4" />}>
                                <div className="divide-y divide-black/5">
                                    <KV label="Mobile" value={p?.phone} icon={<Phone className="h-3.5 w-3.5" />} />
                                    <KV label="Email" value={p?.email} icon={<Mail className="h-3.5 w-3.5" />} />
                                </div>
                            </Card>

                            <Card title="Reference & Credit" icon={<ShieldCheck className="h-4 w-4" />}>
                                <div className="divide-y divide-black/5">
                                    <KV label="Reference Source" value={formatRefSource(p?.ref_source)} />
                                    <KV label="Referring Doctor" value={p?.ref_doctor_name} />
                                    <KV label="Credit Type" value={p?.credit_type} />
                                    <KV label="Payer" value={p?.credit_payer_name} />
                                    <KV label="TPA" value={p?.credit_tpa_name} />
                                    <KV label="Credit Plan" value={p?.credit_plan_name} />
                                    <KV label="Policy Number" value={p?.policy_number} />
                                    <KV label="Policy Name" value={p?.policy_name} />
                                    <KV label="Principal Member" value={p?.principal_member_name} />
                                    <KV label="Family ID" value={p?.family_id} />
                                </div>
                            </Card>

                            <Card title="Address" icon={<MapPin className="h-4 w-4" />}>
                                <pre className="whitespace-pre-wrap text-[12px] text-slate-800 leading-relaxed">
                                    {addressText}
                                </pre>
                            </Card>
                        </>
                    )}

                    {tab === 'attachments' && (
                        <>
                            <Card
                                title="Upload"
                                icon={<Upload className="h-4 w-4" />}
                                right={
                                    <span className="text-[11px] text-slate-500">
                                        {docs.length ? `${docs.length} file(s)` : 'No files'}
                                    </span>
                                }
                            >
                                <form onSubmit={handleUploadDoc} className="grid gap-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <select
                                            className="h-10 rounded-xl border border-black/50 bg-white px-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-black/10"
                                            value={newDocType}
                                            onChange={(e) => setNewDocType(e.target.value)}
                                        >
                                            <option value="other">Other</option>
                                            <option value="id_proof">ID Proof</option>
                                            <option value="report">Report</option>
                                            <option value="photo">Photo</option>
                                        </select>

                                        <div className="sm:col-span-2">
                                            <input
                                                type="file"
                                                className="block w-full text-[12px] text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-white hover:file:bg-slate-800"
                                                onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={uploading || !newDocFile}
                                            className={[
                                                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold transition',
                                                uploading || !newDocFile
                                                    ? 'bg-black/[0.08] text-slate-500 cursor-not-allowed'
                                                    : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]',
                                            ].join(' ')}
                                        >
                                            <Upload className="h-4 w-4" />
                                            {uploading ? 'Uploading…' : 'Upload'}
                                        </button>
                                    </div>
                                </form>
                            </Card>

                            <Card title="Files" icon={<ImageIcon className="h-4 w-4" />}>
                                <div className="overflow-hidden rounded-2xl border border-black/50 bg-white">
                                    {docs.length === 0 ? (
                                        <div className="px-4 py-4 text-[12px] text-slate-500 flex items-center gap-2">
                                            <Inbox className="h-4 w-4 text-slate-300" />
                                            No attachments yet.
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-black/5">
                                            {docs.map((d) => (
                                                <li
                                                    key={d.id}
                                                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-black/[0.02] transition"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="truncate text-[12px] font-semibold text-slate-900">
                                                            {d.filename}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">
                                                            {safe(d.type)} • {formatBytes(d.size)}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => openPreview(d)}
                                                            className="rounded-full border border-black/50 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-black/[0.03]"
                                                        >
                                                            Preview
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownload(d)}
                                                            className="rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-800"
                                                        >
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <Download className="h-4 w-4" />
                                                                Download
                                                            </span>
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </Card>
                        </>
                    )}

                    {tab === 'consents' && (
                        <>
                            <Card title="Add Consent" icon={<FileText className="h-4 w-4" />}>
                                <form onSubmit={handleCreateConsent} className="grid gap-2">
                                    <input
                                        className="h-10 rounded-xl border border-black/50 bg-white px-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-black/10"
                                        placeholder="Consent type (e.g., General / Surgery)"
                                        value={newConsentType}
                                        onChange={(e) => setNewConsentType(e.target.value)}
                                    />
                                    <textarea
                                        rows={3}
                                        className="rounded-xl border border-black/50 bg-white px-3 py-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-black/10"
                                        placeholder="Consent text"
                                        value={newConsentText}
                                        onChange={(e) => setNewConsentText(e.target.value)}
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={savingConsent || !newConsentType || !newConsentText}
                                            className={[
                                                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold transition',
                                                savingConsent || !newConsentType || !newConsentText
                                                    ? 'bg-black/[0.08] text-slate-500 cursor-not-allowed'
                                                    : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]',
                                            ].join(' ')}
                                        >
                                            {savingConsent ? 'Saving…' : 'Add Consent'}
                                        </button>
                                    </div>
                                </form>
                            </Card>

                            <Card
                                title="Saved Consents"
                                icon={<ShieldCheck className="h-4 w-4" />}
                                right={
                                    <span className="text-[11px] text-slate-500">
                                        {consents.length ? `${consents.length} item(s)` : 'Empty'}
                                    </span>
                                }
                            >
                                <div className="overflow-hidden rounded-2xl border border-black/50 bg-white">
                                    {consents.length === 0 ? (
                                        <div className="px-4 py-4 text-[12px] text-slate-500 flex items-center gap-2">
                                            <Inbox className="h-4 w-4 text-slate-300" />
                                            No consents captured yet.
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-black/5">
                                            {consents.map((c) => (
                                                <li key={c.id} className="px-4 py-3">
                                                    <div className="text-[12px] font-semibold text-slate-900">
                                                        {safe(c.type)}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        {c.captured_at ? new Date(c.captured_at).toLocaleString() : '—'}
                                                    </div>
                                                    <div className="mt-2 text-[12px] text-slate-800 whitespace-pre-line leading-relaxed">
                                                        {safe(c.text)}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </Card>
                        </>
                    )}

                    {tab === 'activity' && (
                        <Card
                            title="Activity / Audit Trail"
                            icon={<Activity className="h-4 w-4" />}
                            right={
                                <span className="text-[11px] text-slate-500">
                                    {auditLoading
                                        ? 'Loading…'
                                        : auditLogs.length
                                            ? `Latest ${auditLogs.length}`
                                            : 'No history'}
                                </span>
                            }
                        >
                            {auditLogs.length === 0 && !auditLoading ? (
                                <div className="rounded-2xl border border-black/50 bg-white px-4 py-4 text-[12px] text-slate-500 flex items-center gap-2">
                                    <Inbox className="h-4 w-4 text-slate-300" />
                                    No audit history for this patient.
                                </div>
                            ) : null}

                            {auditLogs.length > 0 ? (
                                <div className="space-y-2">
                                    {auditLogs.map((log) => {
                                        const changes = getAuditChanges(log)
                                        const actor =
                                            log.user_name ||
                                            log.user_email ||
                                            (log.user_id ? `User #${log.user_id}` : 'System')

                                        return (
                                            <div key={log.id} className="rounded-2xl border border-black/50 bg-white p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-[12px] font-semibold text-slate-900">
                                                        {safe(log.action || 'UPDATE')}
                                                        <span className="ml-2 text-[12px] font-normal text-slate-500">
                                                            {safe(actor)}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {log?.created_at ? formatIST(log.created_at) : ' '}
                                                    </div>
                                                </div>

                                                {changes.length > 0 ? (
                                                    <ul className="mt-2 space-y-1 text-[12px]">
                                                        {changes.slice(0, 4).map((ch) => (
                                                            <li key={ch.field} className="text-slate-700">
                                                                <span className="font-medium text-slate-900">{ch.field}</span>{' '}
                                                                <span className="text-slate-500">→</span>{' '}
                                                                <span className="font-medium">{formatAuditValue(ch.after)}</span>
                                                            </li>
                                                        ))}
                                                        {changes.length > 4 ? (
                                                            <li className="text-[11px] text-slate-500">
                                                                +{changes.length - 4} more change(s)
                                                            </li>
                                                        ) : null}
                                                    </ul>
                                                ) : (
                                                    <div className="mt-2 text-[12px] text-slate-600">
                                                        Multiple fields updated.
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : null}
                        </Card>
                    )}
                </div>

                {/* preview modal */}
                {previewDoc ? (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm"
                        onClick={closePreview}
                    >
                        <div
                            className="relative w-full max-w-4xl h-[84vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-4 py-3 border-b border-black/50 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-[13px] font-semibold text-slate-900">
                                        {previewDoc.filename}
                                    </div>
                                    <div className="text-[11px] text-slate-500">{previewType || 'Unknown type'}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleDownload(previewDoc)}
                                        className="rounded-full bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
                                    >
                                        <span className="inline-flex items-center gap-1.5">
                                            <Download className="h-4 w-4" />
                                            Download
                                        </span>
                                    </button>
                                    <IconButton title="Close preview" onClick={closePreview}>
                                        <X className="h-4 w-4" />
                                    </IconButton>
                                </div>
                            </div>

                            <div className="flex-1 bg-slate-50 flex items-center justify-center">
                                {isImage ? (
                                    <img
                                        src={previewUrl}
                                        alt={previewDoc.filename}
                                        className="max-h-full max-w-full object-contain"
                                    />
                                ) : isPdf ? (
                                    <iframe src={previewUrl} title={previewDoc.filename} className="w-full h-full" />
                                ) : (
                                    <div className="px-6 text-center text-[12px] text-slate-600 space-y-2">
                                        <p>This file type can’t be previewed here.</p>
                                        <button
                                            type="button"
                                            onClick={() => handleDownload(previewDoc)}
                                            className="rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
                                        >
                                            Download file
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
