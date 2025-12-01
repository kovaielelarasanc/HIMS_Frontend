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
} from '../api/patients'

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

export default function PatientDetailDrawer({
    open,
    onClose,
    patient,
    onUpdated,
}) {
    const [fullPatient, setFullPatient] = useState(null)
    const [docs, setDocs] = useState([])
    const [consents, setConsents] = useState([])

    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [savingConsent, setSavingConsent] = useState(false)
    const [error, setError] = useState('')

    const [newDocFile, setNewDocFile] = useState(null)
    const [newDocType, setNewDocType] = useState('other')

    const [newConsentType, setNewConsentType] = useState('')
    const [newConsentText, setNewConsentText] = useState('')

    // ABHA demo
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

    // const handleAbhaGenerate = async () => {
    //     if (!p.phone || !p.dob) {
    //         setError('Need mobile and DOB to generate ABHA (demo).')
    //         return
    //     }
    //     setError('')
    //     try {
    //         const res = await abhaGenerate({
    //             name: `${p.first_name} ${p.last_name || ''}`.trim(),
    //             dob: p.dob,
    //             mobile: p.phone,
    //         })
    //         setAbhaTxnId(res.data.txnId)
    //         setAbhaPhase('otp')
    //         // res.data.debug_otp may contain demo OTP in dev
    //     } catch (err) {
    //         const msg =
    //             err?.response?.data?.detail ||
    //             err?.message ||
    //             'Failed to generate ABHA OTP'
    //         setError(msg)
    //     }
    // }

    // const handleAbhaVerify = async () => {
    //     if (!abhaTxnId || !abhaOtp) return
    //     setError('')
    //     try {
    //         await abhaVerifyOtp({
    //             txnId: abhaTxnId,
    //             otp: abhaOtp,
    //             patientId: p.id,
    //         })
    //         setAbhaPhase('idle')
    //         setAbhaOtp('')
    //         setAbhaTxnId('')
    //         await loadAll(p.id)
    //     } catch (err) {
    //         const msg =
    //             err?.response?.data?.detail ||
    //             err?.message ||
    //             'ABHA OTP verification failed'
    //         setError(msg)
    //     }
    // }

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

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-stretch justify-center">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

            {/* Detail Modal */}
            <div
                className="relative z-10 w-full max-w-5xl h-full sm:h-[95vh] mx-auto my-0 sm:my-4 bg-white rounded-none sm:rounded-3xl shadow-xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                        <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                            {p.first_name} {p.last_name || ''}
                        </h2>
                        <p className="text-xs text-slate-500">
                            UHID: {p.uhid} · Age: {ageText || '—'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {p.patient_type && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-900/5 text-[11px] text-slate-700 border border-slate-200">
                                {p.patient_type}
                            </span>
                        )}
                        {p.tag && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[11px] text-emerald-700 border border-emerald-100">
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
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 bg-slate-50/60">
                    {loading && (
                        <div className="text-xs text-slate-500">Loading details…</div>
                    )}
                    {error && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 flex flex-wrap gap-2 items-center">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-black bg-green-500 hover:bg-slate-50"
                        >
                            Print Info / PDF
                        </button>
{/* 
                        {!p.abha_number && (
                            <button
                                type="button"
                                onClick={handleAbhaGenerate}
                                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                Generate ABHA (Demo)
                            </button>
                        )} */}
                        {/* {p.abha_number && (
                            <span className="px-3 py-1.5 text-xs rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                                ABHA: {p.abha_number}
                            </span>
                        )} */}
                    </section>

                    {/* {abhaPhase === 'otp' && (
                        <section className="border border-emerald-200 bg-emerald-50 rounded-2xl p-3 sm:p-4 space-y-2">
                            <p className="text-xs text-emerald-800 font-medium">
                                Enter demo OTP (check debug_otp in response while developing).
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                <input
                                    className="flex-1 border border-emerald-200 rounded-lg px-2 py-1 text-sm"
                                    placeholder="Enter OTP"
                                    value={abhaOtp}
                                    onChange={(e) => setAbhaOtp(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={handleAbhaVerify}
                                    className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    Verify
                                </button>
                            </div>
                        </section>
                    )} */}

                    {/* Patient info + reference + address */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Patient basics */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2">
                            <h3 className="text-xs font-semibold text-slate-800 mb-1.5">
                                Patient Info
                            </h3>
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                                <div>
                                    <span className="font-medium text-slate-600">Gender: </span>
                                    <span className="font-medium text-slate-800">{safe(p.gender)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">DOB: </span>
                                    <span className="font-medium text-slate-800">{p.dob || '—'}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">Age: </span>
                                    <span className="font-medium text-slate-800">{ageText || '—'}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Blood Group:{' '}
                                    </span>
                                    <span className="font-medium text-slate-800">{safe(p.blood_group)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Marital Status:{' '}
                                    </span>
                                    <span className="font-medium text-slate-800">{safe(p.marital_status)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">Mobile: </span>
                                    <span className="font-medium text-slate-800">{safe(p.phone)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">Email: </span>
                                    <span className="font-medium text-slate-800">{safe(p.email)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Patient Type:{' '}
                                    </span>
                                    <span className="font-medium text-slate-800">{safe(p.patient_type)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">Tag: </span>
                                    <span className="font-medium text-slate-800">{safe(p.tag)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Religion:{' '}
                                    </span>
                                    <span className="font-medium text-slate-800">{safe(p.religion)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Occupation:{' '}
                                    </span>
                                    <span className="font-medium text-slate-800">{safe(p.occupation)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        File No:{' '}
                                    </span>
                                    <span className="font-medium text-slate-800">{safe(p.file_number)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        File Location:{' '}
                                    </span>
                                    <span className="font-medium text-slate-800">{safe(p.file_location)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">Guardian:{' '}</span>
                                    <span className="font-medium text-slate-800">{safe(p.guardian_name)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-600">
                                        Guardian Phone:{' '}
                                    </span>
                                    <span className="font-medium text-slate-800">{safe(p.guardian_phone)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Reference & Credit / Insurance + Address */}
                        <div className="space-y-3">
                            <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2">
                                <h3 className="text-xs font-semibold text-slate-800 mb-1.5">
                                    Reference & Credit / Insurance
                                </h3>
                                <div className="grid grid-cols-2 gap-1.5 text-xs">
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Reference Source:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{formatRefSource(p.ref_source)}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Referring Doctor:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{safe(p.ref_doctor_name)}</span>
                                    </div>

                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Credit Type:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{safe(p.credit_type)}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Payer:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{safe(p.credit_payer_name)}</span>
                                    </div>

                                    <div>
                                        <span className="font-medium text-slate-600">TPA:{' '}</span>
                                        <span className="font-medium text-slate-800">{safe(p.credit_tpa_name)}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Credit Plan:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{safe(p.credit_plan_name)}</span>
                                    </div>

                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Policy Number:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{safe(p.policy_number)}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Policy Name:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{safe(p.policy_name)}</span>
                                    </div>

                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Principal Member:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{safe(p.principal_member_name)}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-slate-600">
                                            Family ID:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{safe(p.family_id)}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-medium text-slate-600">
                                            Principal Member Address:{' '}
                                        </span>
                                        <span className="font-medium text-slate-800">{safe(p.principal_member_address)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4">
                                <h3 className="text-xs font-semibold text-slate-800 mb-1.5">
                                    Address
                                </h3>
                                <p className="text-xs text-slate-700">
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

                    {/* Documents */}
                    <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xs font-semibold text-slate-800">
                                Attachments
                            </h3>
                        </div>
                        <form
                            onSubmit={handleUploadDoc}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs"
                        >
                            <select
                                className="border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-black"
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
                                className="flex-1 text-xs text-gray-700"
                                onChange={(e) => setNewDocFile(e.target.files[0] || null)}
                            />
                            <button
                                type="submit"
                                disabled={uploading || !newDocFile}
                                className="px-2 py-1 rounded-lg bg-slate-900 text-white disabled:opacity-60"
                            >
                                {uploading ? 'Uploading…' : 'Upload'}
                            </button>
                        </form>

                        <ul className="divide-y border border-slate-200 rounded-lg bg-slate-50/60">
                            {docs.length === 0 && (
                                <li className="text-xs text-slate-500 px-2 py-2">
                                    No attachments yet.
                                </li>
                            )}
                            {docs.map((d) => (
                                <li
                                    key={d.id}
                                    className="px-2 py-1.5 text-xs flex items-center justify-between gap-2"
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
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => openPreview(d)}
                                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-100"
                                        >
                                            Preview
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDownload(d)}
                                            className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[11px] hover:bg-slate-800"
                                        >
                                            Download
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Consents */}
                    <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2">
                        <h3 className="text-xs font-semibold text-slate-800">Consents</h3>
                        <form
                            onSubmit={handleCreateConsent}
                            className="space-y-1.5 text-xs"
                        >
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                                    placeholder="Consent type (eg. General, Surgery)"
                                    value={newConsentType}
                                    onChange={(e) => setNewConsentType(e.target.value)}
                                />
                            </div>
                            <textarea
                                rows={2}
                                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs"
                                placeholder="Consent text"
                                value={newConsentText}
                                onChange={(e) => setNewConsentText(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={savingConsent || !newConsentType || !newConsentText}
                                    className="px-3 py-1 rounded-lg bg-slate-900 text-white disabled:opacity-60"
                                >
                                    {savingConsent ? 'Saving…' : 'Add Consent'}
                                </button>
                            </div>
                        </form>

                        <ul className="divide-y border border-slate-200 rounded-lg bg-slate-50/60">
                            {consents.length === 0 && (
                                <li className="text-xs text-slate-500 px-2 py-2">
                                    No consents captured yet.
                                </li>
                            )}
                            {consents.map((c) => (
                                <li key={c.id} className="px-2 py-1.5 text-xs">
                                    <div className="font-medium text-slate-800">{c.type}</div>
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
                </div>
            </div>

            {/* Preview Modal */}
            {previewDoc && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                    <div
                        className="relative w-full max-w-3xl h-[80vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden"
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
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={closePreview}
                                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-lg leading-none"
                                >
                                    ×
                                </button>
                            </div>
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
                                        className="inline-flex px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs hover:bg-slate-800"
                                    >
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
