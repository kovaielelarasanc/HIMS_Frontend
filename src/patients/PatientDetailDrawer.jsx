// FILE: src/patients/PatientDetailDrawer.jsx
import { useEffect, useState } from 'react'
import API from '../api/client'
import {
    getPatient,
    listPatientDocuments,
    listPatientConsents,
    uploadPatientDocument,
    createPatientConsent,
    openPatientPrintWindow,
    abhaGenerate,
    abhaVerifyOtp,
    listPatientAuditLogs,
} from '../api/patients'
import {
    User,
    FileText,
    Printer,
    FileUp,
    Download,
    Image as ImageIcon,
    ShieldCheck,
    Activity,
    Inbox,
} from 'lucide-react'

function safe(val) {
    return val || '—'
}

function formatRefSource(code) {
    if (!code) return '—'
    const map = {
        doctor: 'Doctor',
        google: 'Google',
        social_media: 'Social Media',
        ads: 'Advertisements',
        other: 'Other',
    }
    return map[code] || code
}

// ---- helpers for audit log UI ----

function formatAuditValue(value) {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return '—'
        return trimmed.length > 24 ? `${trimmed.slice(0, 24)}…` : trimmed
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value)
    }
    try {
        const json = JSON.stringify(value)
        return json.length > 24 ? `${json.slice(0, 24)}…` : json
    } catch {
        return '—'
    }
}

function getAuditChanges(log) {
    const oldVals = log?.old_values || {}
    const newVals = log?.new_values || {}

    const keys = Array.from(
        new Set([...Object.keys(oldVals || {}), ...Object.keys(newVals || {})])
    )

    const changes = []
    for (const key of keys) {
        const before = oldVals ? oldVals[key] : undefined
        const after = newVals ? newVals[key] : undefined

        const beforeStr =
            before === undefined ? undefined : JSON.stringify(before)
        const afterStr = after === undefined ? undefined : JSON.stringify(after)

        if (beforeStr !== afterStr) {
            changes.push({
                field: key,
                before,
                after,
            })
        }
    }
    return changes
}

export default function PatientDetailDrawer({
    open,
    onClose,
    patient,
    onUpdated,
}) {
    const [fullPatient, setFullPatient] = useState(null)
    const [docs, setDocs] = useState([])
    const [consents, setConsents] = useState([])
    const [auditLogs, setAuditLogs] = useState([])

    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [savingConsent, setSavingConsent] = useState(false)
    const [auditLoading, setAuditLoading] = useState(false)
    const [error, setError] = useState('')

    const [newDocFile, setNewDocFile] = useState(null)
    const [newDocType, setNewDocType] = useState('other')

    const [newConsentType, setNewConsentType] = useState('')
    const [newConsentText, setNewConsentText] = useState('')

    // ABHA demo (unused for now but kept for future)
    const [abhaTxnId, setAbhaTxnId] = useState('')
    const [abhaOtp, setAbhaOtp] = useState('')
    const [abhaPhase, setAbhaPhase] = useState('idle') // idle | otp

    // Preview modal state
    const [previewDoc, setPreviewDoc] = useState(null)
    const [previewUrl, setPreviewUrl] = useState('')
    const [previewType, setPreviewType] = useState('')

    useEffect(() => {
        if (open && patient) {
            loadAll(patient.id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, patient?.id])

    const loadAll = async (id) => {
        setLoading(true)
        setError('')
        try {
            const [pRes, dRes, cRes] = await Promise.all([
                getPatient(id),
                listPatientDocuments(id),
                listPatientConsents(id),
            ])
            setFullPatient(pRes.data)
            setDocs(dRes.data || [])
            setConsents(cRes.data || [])
            onUpdated && onUpdated(pRes.data)
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to load patient details'
            setError(msg)
        } finally {
            setLoading(false)
        }

        // Load audit logs separately so failure here doesn't block patient view
        setAuditLoading(true)
        try {
            const res = await listPatientAuditLogs(id, { limit: 30 })
            setAuditLogs(res.data || [])
        } catch (err) {
            // silently ignore audit log error
        } finally {
            setAuditLoading(false)
        }
    }

    if (!open || !patient) return null

    const p = fullPatient || patient
    const primaryAddress = (p.addresses && p.addresses[0]) || null
    const ageText = p.age_text || ''

    const handleUploadDoc = async (e) => {
        e.preventDefault()
        if (!newDocFile) return
        setUploading(true)
        setError('')
        try {
            const res = await uploadPatientDocument(p.id, {
                type: newDocType,
                file: newDocFile,
            })
            setDocs((prev) => [res.data, ...prev])
            setNewDocFile(null)
            setNewDocType('other')
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to upload document'
            setError(msg)
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
            const res = await createPatientConsent(p.id, {
                type: newConsentType,
                text: newConsentText,
            })
            setConsents((prev) => [res.data, ...prev])
            setNewConsentType('')
            setNewConsentText('')
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save consent'
            setError(msg)
        } finally {
            setSavingConsent(false)
        }
    }

    const handlePrint = async () => {
        setError('')
        try {
            await openPatientPrintWindow(p.id)
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to open print view'
            setError(msg)
        }
    }

    // --- preview helpers: use axios with Authorization + blob ---
    const openPreview = async (doc) => {
        setError('')
        try {
            const res = await API.get(`/patients/documents/${doc.id}/file`, {
                responseType: 'blob',
            })
            const blob = res.data
            const contentType =
                res.headers['content-type'] ||
                doc.mime ||
                doc.content_type ||
                doc.mime_type ||
                ''

            const url = URL.createObjectURL(
                contentType ? new Blob([blob], { type: contentType }) : blob
            )

            setPreviewDoc(doc)
            setPreviewUrl(url)
            setPreviewType(contentType)
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to load attachment for preview'
            setError(msg)
        }
    }

    const closePreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }
        setPreviewDoc(null)
        setPreviewUrl('')
        setPreviewType('')
    }

    const handleDownload = async (doc) => {
        setError('')
        try {
            const res = await API.get(`/patients/documents/${doc.id}/file`, {
                responseType: 'blob',
            })
            const blob = res.data
            const contentType =
                res.headers['content-type'] ||
                doc.mime ||
                doc.content_type ||
                doc.mime_type ||
                'application/octet-stream'

            const url = URL.createObjectURL(
                contentType ? new Blob([blob], { type: contentType }) : blob
            )
            const a = document.createElement('a')
            a.href = url
            a.download = doc.filename || 'document'
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to download attachment'
            setError(msg)
        }
    }

    const isImage =
        previewDoc &&
        (previewType?.startsWith('image/') ||
            /\.(png|jpe?g|gif|webp|bmp)$/i.test(previewDoc.filename || ''))

    const isPdf =
        previewDoc &&
        (previewType === 'application/pdf' ||
            /\.pdf$/i.test(previewDoc.filename || ''))

    const smallBadge =
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium'

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            {/* Main patient detail modal (bottom sheet on mobile, centered on desktop) */}
            <div
                className="w-full bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] sm:max-h-[90vh] sm:max-w-5xl mx-auto overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-sm">
                                <User className="h-4 w-4" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                                    {p.first_name} {p.last_name || ''}
                                </h2>
                                <p className="text-[11px] sm:text-xs text-slate-500">
                                    UHID: {p.uhid} · Age: {ageText || '—'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {p.patient_type && (
                            <span
                                className={`${smallBadge} bg-slate-900/5 text-slate-800 border border-slate-200`}
                            >
                                {p.patient_type}
                            </span>
                        )}
                        {p.tag && (
                            <span
                                className={`${smallBadge} bg-emerald-50 text-emerald-700 border border-emerald-100`}
                            >
                                {p.tag}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-lg leading-none"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 bg-slate-50/80">
                    {loading && (
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs sm:text-sm text-slate-500 shadow-sm">
                            Loading patient details…
                        </div>
                    )}
                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-3 py-2 text-xs sm:text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <section className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-3 flex flex-wrap gap-2 items-center">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
                        >
                            <Printer className="h-4 w-4" />
                            <span>Print Info / PDF</span>
                        </button>
                        {/* Future ABHA buttons can go here */}
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                            Patient profile & audit-ready.
                        </span>
                    </section>

                    {/* Patient info + Reference / Address */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Patient basics */}
                        <div className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 space-y-2">
                            <div className="flex items-center gap-2 mb-1.5">
                                <FileText className="h-4 w-4 text-slate-500" />
                                <h3 className="text-sm font-semibold text-slate-800">
                                    Patient Info
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:text-xs">
                                <div>
                                    <span className="font-medium text-slate-600">Gender: </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.gender)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">DOB: </span>
                                    <span className="font-semibold text-slate-800">
                                        {p.dob || '—'}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">Age: </span>
                                    <span className="font-semibold text-slate-800">
                                        {ageText || '—'}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Blood Group:{' '}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.blood_group)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Marital Status:{' '}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.marital_status)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">Mobile: </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.phone)}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <span className="font-medium text-slate-600">Email: </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.email)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Patient Type:{' '}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.patient_type)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">Tag: </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.tag)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Religion:{' '}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.religion)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Occupation:{' '}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.occupation)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        File No:{' '}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.file_number)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        File Location:{' '}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.file_location)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Guardian:{' '}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.guardian_name)}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Guardian Phone:{' '}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                        {safe(p.guardian_phone)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Reference / Credit & Address */}
                        <div className="space-y-3">
                            <div className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 space-y-2">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                                    <h3 className="text-sm font-semibold text-slate-800">
                                        Reference & Credit / Insurance
                                    </h3>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:text-xs">
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Reference Source:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {formatRefSource(p.ref_source)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Referring Doctor:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.ref_doctor_name)}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Credit Type:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.credit_type)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Payer:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.credit_payer_name)}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="font-medium text-slate-600">
                                            TPA:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.credit_tpa_name)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Credit Plan:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.credit_plan_name)}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Policy Number:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.policy_number)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Policy Name:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.policy_name)}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Principal Member:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.principal_member_name)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Family ID:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.family_id)}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-medium text-slate-600">
                                            Principal Member Address:{' '}
                                        </span>
                                        <span className="font-semibold text-slate-800">
                                            {safe(p.principal_member_address)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <FileText className="h-4 w-4 text-slate-500" />
                                    <h3 className="text-sm font-semibold text-slate-800">
                                        Address
                                    </h3>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-700">
                                    {primaryAddress ? (
                                        <>
                                            {primaryAddress.line1}
                                            <br />
                                            {primaryAddress.line2 && (
                                                <>
                                                    {primaryAddress.line2}
                                                    <br />
                                                </>
                                            )}
                                            {[primaryAddress.city, primaryAddress.state, primaryAddress.pincode]
                                                .filter(Boolean)
                                                .join(', ')}
                                            <br />
                                            {primaryAddress.country}
                                        </>
                                    ) : (
                                        '—'
                                    )}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Attachments */}
                    <section className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <ImageIcon className="h-4 w-4 text-slate-500" />
                                <h3 className="text-sm font-semibold text-slate-800">
                                    Attachments
                                </h3>
                            </div>
                        </div>
                        <form
                            onSubmit={handleUploadDoc}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs"
                        >
                            <select
                                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                                value={newDocType}
                                onChange={(e) => setNewDocType(e.target.value)}
                            >
                                <option value="other">Other</option>
                                <option value="id_proof">ID Proof</option>
                                <option value="report">Report</option>
                                <option value="photo">Photo</option>
                            </select>
                            <input
                                type="file"
                                className="flex-1 text-xs text-slate-700 file:mr-2 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
                                onChange={(e) => setNewDocFile(e.target.files[0] || null)}
                            />
                            <button
                                type="submit"
                                disabled={uploading || !newDocFile}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 active:scale-95 transition"
                            >
                                <FileUp className="h-3.5 w-3.5" />
                                {uploading ? 'Uploading…' : 'Upload'}
                            </button>
                        </form>

                        <ul className="divide-y border border-slate-200 rounded-2xl bg-slate-50/80">
                            {docs.length === 0 && (
                                <li className="text-xs text-slate-500 px-3 py-3 flex items-center gap-2">
                                    <Inbox className="h-4 w-4 text-slate-300" />
                                    <span>No attachments yet.</span>
                                </li>
                            )}
                            {docs.map((d) => (
                                <li
                                    key={d.id}
                                    className="px-3 py-2 text-xs flex items-center justify-between gap-2"
                                >
                                    <div className="min-w-0">
                                        <div className="font-medium text-slate-800 truncate">
                                            {d.filename}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {d.type || 'other'} ·{' '}
                                            {d.size ? `${(d.size / 1024).toFixed(1)} KB` : '—'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => openPreview(d)}
                                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                                        >
                                            Preview
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDownload(d)}
                                            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 transition"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                            Download
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Consents */}
                    <section className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-500" />
                            <h3 className="text-sm font-semibold text-slate-800">
                                Consents
                            </h3>
                        </div>
                        <form
                            onSubmit={handleCreateConsent}
                            className="space-y-2 text-xs"
                        >
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                                    placeholder="Consent type (e.g. General, Surgery)"
                                    value={newConsentType}
                                    onChange={(e) => setNewConsentType(e.target.value)}
                                />
                            </div>
                            <textarea
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                                placeholder="Consent text"
                                value={newConsentText}
                                onChange={(e) => setNewConsentText(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={savingConsent || !newConsentType || !newConsentText}
                                    className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 active:scale-95 transition"
                                >
                                    {savingConsent ? 'Saving…' : 'Add Consent'}
                                </button>
                            </div>
                        </form>

                        <ul className="divide-y border border-slate-200 rounded-2xl bg-slate-50/80">
                            {consents.length === 0 && (
                                <li className="text-xs text-slate-500 px-3 py-3 flex items-center gap-2">
                                    <Inbox className="h-4 w-4 text-slate-300" />
                                    <span>No consents captured yet.</span>
                                </li>
                            )}
                            {consents.map((c) => (
                                <li key={c.id} className="px-3 py-2 text-xs">
                                    <div className="font-semibold text-slate-800">
                                        {c.type}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mb-0.5">
                                        {new Date(c.captured_at).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-slate-800 whitespace-pre-line">
                                        {c.text}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Audit trail */}
                    <section className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-slate-500" />
                                <h3 className="text-sm font-semibold text-slate-800">
                                    Activity / Audit Trail
                                </h3>
                            </div>
                            <div className="text-[11px] text-slate-500">
                                {auditLoading
                                    ? 'Loading…'
                                    : auditLogs.length
                                        ? `Latest ${auditLogs.length} change${auditLogs.length > 1 ? 's' : ''}`
                                        : 'No history yet'}
                            </div>
                        </div>

                        {auditLogs.length === 0 && !auditLoading && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 flex items-center gap-2">
                                <Inbox className="h-4 w-4 text-slate-300" />
                                <span>
                                    No change history captured yet for this patient.
                                </span>
                            </div>
                        )}

                        {auditLogs.length > 0 && (
                            <ol className="space-y-2">
                                {auditLogs.map((log) => {
                                    const changes = getAuditChanges(log)
                                    const extraCount =
                                        changes.length > 3 ? changes.length - 3 : 0
                                    const actor =
                                        log.user_name ||
                                        log.user_email ||
                                        (log.user_id
                                            ? `User #${log.user_id}`
                                            : 'System')
                                    const ts = log.created_at
                                        ? new Date(log.created_at).toLocaleString()
                                        : ''

                                    return (
                                        <li key={log.id} className="flex gap-2">
                                            <div className="flex flex-col items-center pt-1">
                                                <div className="h-2 w-2 rounded-full bg-teal-600" />
                                                <div className="mt-1 flex-1 w-px bg-slate-200" />
                                            </div>
                                            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/80 px-2.5 py-2">
                                                <div className="flex flex-wrap items-center justify-between gap-1">
                                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                                        <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-1.5 py-0.5 text-[10px] tracking-wide">
                                                            {log.action || 'UPDATE'}
                                                        </span>
                                                        <span className="text-slate-700">
                                                            {actor}
                                                        </span>
                                                    </div>
                                                    {ts && (
                                                        <div className="text-[10px] text-slate-500">
                                                            {ts}
                                                        </div>
                                                    )}
                                                </div>

                                                {changes.length > 0 && (
                                                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-700">
                                                        {changes.slice(0, 3).map((ch) => (
                                                            <li
                                                                key={ch.field}
                                                                className="flex flex-wrap gap-1"
                                                            >
                                                                <span className="font-medium">
                                                                    {ch.field}
                                                                </span>
                                                                <span className="text-slate-500">
                                                                    changed
                                                                </span>
                                                                <span className="line-through text-slate-400">
                                                                    {formatAuditValue(ch.before)}
                                                                </span>
                                                                <span className="mx-1 text-slate-400">
                                                                    →
                                                                </span>
                                                                <span className="font-medium">
                                                                    {formatAuditValue(ch.after)}
                                                                </span>
                                                            </li>
                                                        ))}
                                                        {extraCount > 0 && (
                                                            <li className="text-[10px] text-slate-500">
                                                                +{extraCount} more field
                                                                {extraCount > 1 ? 's' : ''} updated
                                                            </li>
                                                        )}
                                                    </ul>
                                                )}

                                                {changes.length === 0 &&
                                                    (log.old_values || log.new_values) && (
                                                        <p className="mt-1.5 text-[11px] text-slate-600">
                                                            Multiple fields updated.
                                                        </p>
                                                    )}

                                                {(log.ip_address || log.user_agent) && (
                                                    <p className="mt-1 text-[10px] text-slate-400">
                                                        {log.ip_address && (
                                                            <span>IP: {log.ip_address}</span>
                                                        )}
                                                        {log.ip_address && log.user_agent && (
                                                            <span className="mx-1">·</span>
                                                        )}
                                                        {log.user_agent && (
                                                            <span className="line-clamp-1">
                                                                {log.user_agent}
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ol>
                        )}
                    </section>
                </div>
            </div>

            {/* Preview Modal */}
            {previewDoc && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={closePreview}
                >
                    <div
                        className="relative w-full max-w-3xl h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Preview – {previewDoc.filename}
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    {previewType || 'Unknown type'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closePreview}
                                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-lg leading-none"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-50 flex items-center justify-center">
                            {isImage && (
                                <img
                                    src={previewUrl}
                                    alt={previewDoc.filename}
                                    className="max-h-full max-w-full object-contain"
                                />
                            )}
                            {isPdf && (
                                <iframe
                                    src={previewUrl}
                                    title={previewDoc.filename}
                                    className="w-full h-full"
                                />
                            )}
                            {!isImage && !isPdf && (
                                <div className="text-xs text-slate-600 px-4 text-center space-y-2">
                                    <p>This file type cannot be previewed inline.</p>
                                    <button
                                        type="button"
                                        onClick={() => handleDownload(previewDoc)}
                                        className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download file
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
