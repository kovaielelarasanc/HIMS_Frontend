import React, { useEffect, useMemo, useState } from 'react'
import { getPreOpChecklist, updatePreOpChecklist, getPreopChecklistPdf } from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import {
    ClipboardCheck,
    CheckCircle2,
    AlertCircle,
    Printer,
    Download,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatIST } from '@/ipd/components/timeZONE'

/* ----------------- CONFIG ----------------- */
const CHECKLIST_ITEMS = [
    { key: 'allergy', label: 'Allergy' },
    { key: 'consent_form_signed', label: 'Consent form signed' },
    { key: 'written_high_risk_signed', label: 'Written high risk form signed' },
    { key: 'identity_bands_checked', label: 'Identity bands checked' },
    { key: 'npo', label: 'Nil per mouth (NPO)' },
    { key: 'pre_medication_given', label: 'Pre-medication given' },
    { key: 'test_dose_given', label: 'Test dose given' },
    { key: 'bowel_preparation', label: 'Bowel preparation' },
    { key: 'bladder_empty_time', label: 'Bladder empty time' },
    { key: 'serology_results', label: 'Serology results' },
    { key: 'blood_grouping', label: 'Blood grouping' },
    { key: 'blood_reservation', label: 'Blood reservation' },
    { key: 'patient_files_with_records', label: 'Patient files (IP/OP), ECG / X-ray with old records' },
    { key: 'pre_anaesthetic_evaluation', label: 'Pre-anaesthetic evaluation' },
    { key: 'jewellery_nailpolish_removed', label: 'Jewellery, nail polish, make-up removed' },
    { key: 'prosthesis_dentures_wig_contactlens_removed', label: 'Prosthesis / dentures / wig / contact lens removed' },
    { key: 'sterile_preparation_done', label: 'Sterile preparation done' },
]

const DEFAULT_FORM = () => ({
    checklist: CHECKLIST_ITEMS.reduce((acc, item) => {
        acc[item.key] = { handover: false, receiving: false, comments: '' }
        return acc
    }, {}),
    investigations: {
        hb: '',
        platelet: '',
        urea: '',
        creatinine: '',
        potassium: '',
        rbs: '',
        other: '',
    },
    vitals: {
        temp: '',
        pulse: '',
        resp: '',
        bp: '',
        spo2: '',
        height: '',
        weight: '',
    },
    shave_completed: null, // 'yes' | 'no' | null
    nurse_signature: '',
})

const hydrateForm = (incoming) => {
    const base = DEFAULT_FORM()
    if (!incoming || typeof incoming !== 'object') return base

    const form = { ...base }

    if (incoming.checklist && typeof incoming.checklist === 'object') {
        form.checklist = { ...base.checklist, ...incoming.checklist }
    }

    // summary → checklist
    if ('patient_identity_confirmed' in incoming) {
        form.checklist.identity_bands_checked = {
            ...form.checklist.identity_bands_checked,
            handover: !!incoming.patient_identity_confirmed,
        }
    }
    if ('consent_checked' in incoming) {
        form.checklist.consent_form_signed = {
            ...form.checklist.consent_form_signed,
            handover: !!incoming.consent_checked,
        }
    }
    if ('investigations_checked' in incoming) {
        form.checklist.patient_files_with_records = {
            ...form.checklist.patient_files_with_records,
            handover: !!incoming.investigations_checked,
        }
    }
    if ('blood_products_arranged' in incoming) {
        form.checklist.blood_reservation = {
            ...form.checklist.blood_reservation,
            handover: !!incoming.blood_products_arranged,
        }
    }
    if ('implants_available' in incoming) {
        form.checklist.prosthesis_dentures_wig_contactlens_removed = {
            ...form.checklist.prosthesis_dentures_wig_contactlens_removed,
            handover: !!incoming.implants_available,
        }
    }
    if ('site_marked' in incoming) {
        form.checklist.pre_anaesthetic_evaluation = {
            ...form.checklist.pre_anaesthetic_evaluation,
            handover: !!incoming.site_marked,
        }
    }

    // comments mapping
    if (incoming.fasting_status) {
        form.checklist.npo = { ...form.checklist.npo, comments: incoming.fasting_status }
    }
    if (incoming.device_checks) {
        form.checklist.pre_anaesthetic_evaluation = {
            ...form.checklist.pre_anaesthetic_evaluation,
            comments: incoming.device_checks,
        }
    }
    if (incoming.notes) {
        form.checklist.sterile_preparation_done = {
            ...form.checklist.sterile_preparation_done,
            comments: incoming.notes,
        }
    }

    if (incoming.investigations) form.investigations = { ...base.investigations, ...incoming.investigations }
    if (incoming.vitals) form.vitals = { ...base.vitals, ...incoming.vitals }
    if ('shave_completed' in incoming) form.shave_completed = incoming.shave_completed
    if ('nurse_signature' in incoming) form.nurse_signature = incoming.nurse_signature || ''

    return form
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => window.URL.revokeObjectURL(url), 1500)
}

export default function PreopTab({ caseId }) {
    const canView =
        useCan('ot.preop_checklist.view') || useCan('ot.cases.view') || useCan('ipd.view')

    const canEdit =
        useCan('ot.preop_checklist.update') ||
        useCan('ot.preop_checklist.create') ||
        useCan('ot.cases.update') ||
        useCan('ipd.doctor')

    const [record, setRecord] = useState(null)
    const [form, setForm] = useState(() => DEFAULT_FORM())
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [pdfBusy, setPdfBusy] = useState(false)

    const progress = useMemo(() => {
        const total = CHECKLIST_ITEMS.length
        let h = 0
        let r = 0
        for (const it of CHECKLIST_ITEMS) {
            const row = form.checklist?.[it.key] || {}
            if (row.handover) h += 1
            if (row.receiving) r += 1
        }
        return { total, h, r }
    }, [form.checklist])

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const rec = await getPreOpChecklist(caseId) // returns data
            setRecord(rec || null)
            setForm(hydrateForm(rec))
        } catch (err) {
            console.error('Failed to load Pre-op checklist', err)
            setRecord(null)
            setForm(DEFAULT_FORM())
            setError(err?.response?.data?.detail || 'Failed to load Pre-op checklist')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, canView])

    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You do not have permission to view pre-operative checklists.
            </div>
        )
    }

    const handleChecklistChange = (key, field, value) => {
        setForm((prev) => ({
            ...prev,
            checklist: {
                ...prev.checklist,
                [key]: {
                    ...prev.checklist[key],
                    [field]: value,
                },
            },
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return

        setSaving(true)
        setError(null)

        try {
            const payload = {
                checklist: form.checklist,
                investigations: { ...form.investigations },
                vitals: { ...form.vitals },
                shave_completed: form.shave_completed,
                nurse_signature: form.nurse_signature || null,

                // mapped summary fields used by backend
                patient_identity_confirmed: !!form.checklist.identity_bands_checked.handover,
                consent_checked: !!form.checklist.consent_form_signed.handover,
                investigations_checked: !!form.checklist.patient_files_with_records.handover,
                blood_products_arranged: !!form.checklist.blood_reservation.handover,
                implants_available: !!form.checklist.prosthesis_dentures_wig_contactlens_removed.handover,
                site_marked: !!form.checklist.pre_anaesthetic_evaluation.handover,
                fasting_status: form.checklist.npo.comments || null,
                device_checks: form.checklist.pre_anaesthetic_evaluation.comments || null,
                notes: form.checklist.sterile_preparation_done.comments || null,

                completed: false,
            }

            // ✅ always PUT (backend upsert handles create/update)
            await updatePreOpChecklist(caseId, payload)
            await load()
        } catch (err) {
            console.error('Failed to save Pre-op checklist', err)
            setError(err?.response?.data?.detail || err?.message || 'Failed to save Pre-op checklist')
        } finally {
            setSaving(false)
        }
    }

    const handleDownloadPdf = async () => {
        try {
            setPdfBusy(true)
            const blob = await getPreopChecklistPdf(caseId, { download: true })
            downloadBlob(blob, `OT_PreOp_Checklist_Case_${caseId}.pdf`)
        } catch (err) {
            console.error('PDF download failed', err)
            setError(err?.response?.data?.detail || err?.message || 'Failed to download PDF')
        } finally {
            setPdfBusy(false)
        }
    }

    const handlePrintPdf = async () => {
        try {
            setPdfBusy(true)
            const blob = await getPreopChecklistPdf(caseId, { download: false })
            const url = window.URL.createObjectURL(blob)
            const w = window.open(url, '_blank', 'noopener,noreferrer')
            // If popup blocked → fallback download
            if (!w) {
                downloadBlob(blob, `OT_PreOp_Checklist_Case_${caseId}.pdf`)
                return
            }
            // Let user print from PDF viewer; auto-print attempt (best-effort)
            setTimeout(() => {
                try {
                    w.focus()
                    w.print()
                } catch { }
            }, 900)
            setTimeout(() => window.URL.revokeObjectURL(url), 2500)
        } catch (err) {
            console.error('PDF print failed', err)
            setError(err?.response?.data?.detail || err?.message || 'Failed to open PDF for print')
        } finally {
            setPdfBusy(false)
        }
    }

    const lastStamp = record?.updated_at || record?.completed_at || record?.created_at

    return (
        <form onSubmit={handleSubmit} className="relative">
            {/* Apple-style shell */}
            <div className="rounded-[28px] border border-slate-200 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]">
                {/* Top header */}
                <div className="rounded-[28px] border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/70 px-4 py-4 md:px-5">
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 shadow-sm">
                                <ClipboardCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900 md:text-lg">
                                    Pre-operative Checklist
                                </div>
                                <div className="text-[12px] text-slate-500">
                                    Checklist · Investigations · Vitals · Body shave · Signature
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <PillStat label="Handover" value={`${progress.h}/${progress.total}`} />
                            <PillStat label="Receiving" value={`${progress.r}/${progress.total}`} />
                            {lastStamp ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Last saved: {formatIST(lastStamp)}
                                </span>
                            ) : null}

                            {/* ✅ Print + Download */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handlePrintPdf}
                                    disabled={pdfBusy || loading}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Printer className="h-4 w-4" />
                                    <span className="hidden sm:inline">Print</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDownloadPdf}
                                    disabled={pdfBusy || loading}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Download</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Body */}
                <div className="p-3 md:p-5">
                    {/* Error */}
                    {error && (
                        <div className="mb-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            <AlertCircle className="mt-0.5 h-4 w-4" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Loading */}
                    {loading ? (
                        <div className="space-y-3">
                            <SkeletonLine />
                            <SkeletonLine />
                            <SkeletonLine />
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Checklist */}
                            <SectionCard
                                title="Checklist"
                                subtitle="Handover + Receiving + Comments (desktop table, mobile cards)."
                            >
                                {/* Desktop header */}
                                <div className="hidden md:grid md:grid-cols-[minmax(280px,1fr)_140px_140px_minmax(260px,1fr)] md:gap-3 md:rounded-2xl md:border md:border-slate-200 md:bg-white md:px-4 md:py-2">
                                    <Hdr>Item</Hdr>
                                    <Hdr>Handover</Hdr>
                                    <Hdr>Receiving</Hdr>
                                    <Hdr>Comments</Hdr>
                                </div>

                                <AnimatePresence initial={false}>
                                    {CHECKLIST_ITEMS.map((item, idx) => {
                                        const row = form.checklist[item.key]
                                        const active = !!row?.handover || !!row?.receiving || !!row?.comments

                                        return (
                                            <motion.div
                                                key={item.key}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                transition={{ duration: 0.16, delay: idx * 0.004 }}
                                                className={
                                                    'rounded-2xl border px-3 py-3 md:px-4 ' +
                                                    (active ? 'border-sky-200 bg-sky-50/60' : 'border-slate-200 bg-white')
                                                }
                                            >
                                                {/* Desktop row */}
                                                <div className="hidden md:grid md:grid-cols-[minmax(280px,1fr)_140px_140px_minmax(260px,1fr)] md:items-center md:gap-3">
                                                    <div className="text-[13px] font-semibold text-slate-900">{item.label}</div>

                                                    <div className="flex items-center">
                                                        <IOSSwitch
                                                            checked={!!row.handover}
                                                            disabled={!canEdit || saving}
                                                            onChange={(v) => handleChecklistChange(item.key, 'handover', v)}
                                                        />
                                                    </div>

                                                    <div className="flex items-center">
                                                        <IOSSwitch
                                                            checked={!!row.receiving}
                                                            disabled={!canEdit || saving}
                                                            onChange={(v) => handleChecklistChange(item.key, 'receiving', v)}
                                                        />
                                                    </div>

                                                    <div>
                                                        <InlineInput
                                                            value={row.comments || ''}
                                                            disabled={!canEdit || saving}
                                                            placeholder="Optional"
                                                            onChange={(v) => handleChecklistChange(item.key, 'comments', v)}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Mobile card */}
                                                <div className="md:hidden">
                                                    <div className="text-[13px] font-semibold text-slate-900">{item.label}</div>

                                                    <div className="mt-2 flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[12px] font-medium text-slate-700">Handover</span>
                                                            <IOSSwitch
                                                                checked={!!row.handover}
                                                                disabled={!canEdit || saving}
                                                                onChange={(v) => handleChecklistChange(item.key, 'handover', v)}
                                                            />
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[12px] font-medium text-slate-700">Receiving</span>
                                                            <IOSSwitch
                                                                checked={!!row.receiving}
                                                                disabled={!canEdit || saving}
                                                                onChange={(v) => handleChecklistChange(item.key, 'receiving', v)}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="mt-2">
                                                        <InlineInput
                                                            value={row.comments || ''}
                                                            disabled={!canEdit || saving}
                                                            placeholder="Comments (optional)"
                                                            onChange={(v) => handleChecklistChange(item.key, 'comments', v)}
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </SectionCard>

                            {/* Investigations + Vitals */}
                            <div className="grid gap-5 lg:grid-cols-2">
                                <SectionCard title="Investigations" subtitle="Enter latest lab values (as available).">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <MiniField label="HB" value={form.investigations.hb} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, investigations: { ...p.investigations, hb: v } }))} />
                                        <MiniField label="Platelet" value={form.investigations.platelet} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, investigations: { ...p.investigations, platelet: v } }))} />
                                        <MiniField label="Urea" value={form.investigations.urea} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, investigations: { ...p.investigations, urea: v } }))} />
                                        <MiniField label="Creatinine" value={form.investigations.creatinine} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, investigations: { ...p.investigations, creatinine: v } }))} />
                                        <MiniField label="Potassium" value={form.investigations.potassium} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, investigations: { ...p.investigations, potassium: v } }))} />
                                        <MiniField label="RBS" value={form.investigations.rbs} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, investigations: { ...p.investigations, rbs: v } }))} />
                                        <div className="sm:col-span-2">
                                            <MiniField label="Other" value={form.investigations.other} disabled={!canEdit || saving}
                                                onChange={(v) => setForm((p) => ({ ...p, investigations: { ...p.investigations, other: v } }))} />
                                        </div>
                                    </div>
                                </SectionCard>

                                <SectionCard title="Vitals" subtitle="Pre-op vitals summary (as recorded).">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <MiniField label="Temp" value={form.vitals.temp} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, vitals: { ...p.vitals, temp: v } }))} />
                                        <MiniField label="Pulse" value={form.vitals.pulse} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, vitals: { ...p.vitals, pulse: v } }))} />
                                        <MiniField label="Resp" value={form.vitals.resp} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, vitals: { ...p.vitals, resp: v } }))} />
                                        <MiniField label="BP" value={form.vitals.bp} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, vitals: { ...p.vitals, bp: v } }))} />
                                        <MiniField label="SpO₂" value={form.vitals.spo2} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, vitals: { ...p.vitals, spo2: v } }))} />
                                        <MiniField label="Height" value={form.vitals.height} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, vitals: { ...p.vitals, height: v } }))} />
                                        <MiniField label="Weight" value={form.vitals.weight} disabled={!canEdit || saving}
                                            onChange={(v) => setForm((p) => ({ ...p, vitals: { ...p.vitals, weight: v } }))} />
                                    </div>
                                </SectionCard>
                            </div>

                            {/* Shave + Signature */}
                            <div className="grid gap-5 lg:grid-cols-2">
                                <SectionCard title="Body shave" subtitle="Record shave completion status (site preparation).">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <SegPill active={form.shave_completed === 'yes'} disabled={!canEdit || saving}
                                            onClick={() => setForm((p) => ({ ...p, shave_completed: 'yes' }))}>
                                            Yes
                                        </SegPill>
                                        <SegPill active={form.shave_completed === 'no'} disabled={!canEdit || saving}
                                            onClick={() => setForm((p) => ({ ...p, shave_completed: 'no' }))}>
                                            No
                                        </SegPill>
                                        <SegPill active={form.shave_completed === null} disabled={!canEdit || saving}
                                            onClick={() => setForm((p) => ({ ...p, shave_completed: null }))}>
                                            Not recorded
                                        </SegPill>
                                    </div>
                                    <div className="mt-2 text-[12px] text-slate-500">
                                        Tip: detailed body marking can be captured in PDF / print workflow.
                                    </div>
                                </SectionCard>

                                <SectionCard title="Nurse signature" subtitle="Signature with name (handover/receiving).">
                                    <MiniField
                                        label="Name & signature"
                                        value={form.nurse_signature}
                                        disabled={!canEdit || saving}
                                        placeholder="Enter nurse name / signature"
                                        onChange={(v) => setForm((p) => ({ ...p, nurse_signature: v }))}
                                    />
                                </SectionCard>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky save bar */}
                {canEdit && (
                    <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/80 backdrop-blur-xl px-3 py-3 md:px-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-[12px] text-slate-500">
                                Changes will be saved to OT case documentation.
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                                {saving && (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                                )}
                                Save Pre-op Checklist
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </form>
    )
}

/* ----------------- UI helpers ----------------- */

function PillStat({ label, value }) {
    return (
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-medium text-slate-700">
            <span className="text-slate-500">{label}:</span>
            <span className="font-semibold text-slate-900">{value}</span>
        </span>
    )
}

function SectionCard({ title, subtitle, children }) {
    return (
        <div className="rounded-[24px] border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-3 shadow-[0_1px_0_rgba(15,23,42,0.06)] md:p-4">
            <div className="mb-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {title}
                </div>
                {subtitle ? <div className="text-[13px] text-slate-600">{subtitle}</div> : null}
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    )
}

function Hdr({ children }) {
    return <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</div>
}

function InlineInput({ value, onChange, placeholder, disabled }) {
    return (
        <input
            type="text"
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            value={value ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
        />
    )
}

function MiniField({ label, value, onChange, placeholder, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <input
                type="text"
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

// iOS-like switch (pure Tailwind)
function IOSSwitch({ checked, onChange, disabled }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={[
                'relative inline-flex h-7 w-12 items-center rounded-full transition',
                checked ? 'bg-sky-600' : 'bg-slate-200',
                disabled ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-[0.98]',
            ].join(' ')}
            aria-pressed={checked}
        >
            <span
                className={[
                    'inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition',
                    checked ? 'translate-x-5' : 'translate-x-1',
                ].join(' ')}
            />
        </button>
    )
}

function SegPill({ active, onClick, disabled, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={[
                'rounded-full px-3 py-2 text-[13px] font-semibold transition',
                active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50',
                'border border-slate-200 shadow-[0_1px_0_rgba(15,23,42,0.06)]',
                disabled ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
        >
            {children}
        </button>
    )
}

function SkeletonLine() {
    return <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100" />
}
