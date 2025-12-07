// FILE: frontend/src/ipd/Discharge.jsx
import { useEffect, useState, useMemo } from 'react'
import {
    getDischargeSummary,
    saveDischargeSummary,
    getDischargeChecklist,
    saveDischargeChecklist,
    listMedications,
    listDischargeMeds,
} from '../../api/ipd'
import PermGate from '../../components/PermGate'
import { toast } from 'sonner'
import API from '@/api/client'
// Convert ISO → datetime-local string (yyyy-MM-ddTHH:mm)
const toInputDateTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    const y = d.getFullYear()
    const m = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const h = pad(d.getHours())
    const min = pad(d.getMinutes())
    return `${y}-${m}-${day}T${h}:${min}`
}

// Convert datetime-local value → ISO-ish string (add :00 if needed)
const toIsoSecs = (v) => (!v ? null : v.length === 16 ? `${v}:00` : v)

// 🔹 Simple ICD-10 sample master (placeholder – later replace with real ICD API)
const ICD10_SAMPLE = [
    { code: 'A90', name: 'Dengue fever' },
    { code: 'I10', name: 'Essential (primary) hypertension' },
    { code: 'E11', name: 'Type 2 diabetes mellitus' },
    { code: 'J45', name: 'Asthma' },
    { code: 'K35', name: 'Acute appendicitis' },
]

export default function Discharge({
    admissionId,
    admission,
    patient,
    canWrite = true,
    followupOptions = [], // optional: OPD follow-up list from parent
}) {
    const [sum, setSum] = useState(null)
    const [chk, setChk] = useState(null)
    const [err, setErr] = useState('')
    const [savingSummary, setSavingSummary] = useState(false)
    const [savingChecklist, setSavingChecklist] = useState(false)

    // follow-up dropdown loading (for future API wiring)
    const [loadingFollowups] = useState(false)

    // ICD-10 search UI state
    const [icdSearch, setIcdSearch] = useState('')
    const [icdSuggestions, setIcdSuggestions] = useState(ICD10_SAMPLE)

    // follow-up dropdown computed
    const hasFollowupOptions =
        Array.isArray(followupOptions) && followupOptions.length > 0

    // follow-up text auto-filled flag (from backend)
    const [autoFollowUp, setAutoFollowUp] = useState(false)

    // --------- Summary form state (extended) ----------
    const [fs, setFs] = useState({
        // existing fields (NOTE: demographics REMOVED – now from props / backend auto-fill)
        medical_history: '',
        treatment_summary: '',
        medications: '',
        follow_up: '',
        icd10_codes: '',
        // A. MUST-HAVE ADDITIONAL FIELDS
        final_diagnosis_primary: '',
        final_diagnosis_secondary: '',
        hospital_course: '',
        discharge_condition: 'stable', // stable / improved / unchanged / dama / expired
        discharge_type: 'routine', // routine / dama / referred / lama / absconded
        allergies: '',
        // B. STRONGLY RECOMMENDED
        procedures: '',
        investigations: '',
        diet_instructions: '',
        activity_instructions: '',
        warning_signs: '',
        referral_details: '',
        // C. OPERATIONAL / ADMIN / BILLING
        insurance_details: '',
        stay_summary: '',
        patient_ack_name: '',
        patient_ack_datetime: '',
        // D. DOCTOR & SYSTEM VALIDATION
        prepared_by_name: '',
        reviewed_by_name: '',
        reviewed_by_regno: '',
        discharge_datetime: '',
        // E. SAFETY & QUALITY
        implants: '',
        pending_reports: '',
        patient_education: '',
        followup_appointment_ref: '',
        // action flag
        finalize: false,
    })

    // --------- Checklist form state ----------
    const [fc, setFc] = useState({
        financial_clearance: false,
        clinical_clearance: false,
        delay_reason: '',
        submit: false,
    })

    // IPD medications (for discharge auto-fill)
    const [medList, setMedList] = useState([])

    const finalized = !!sum?.finalized
    const readOnly = finalized || canWrite === false

    const finalizedAtLabel = useMemo(() => {
        if (!sum?.finalized_at) return ''
        try {
            return new Date(sum.finalized_at).toLocaleString()
        } catch {
            return String(sum.finalized_at)
        }
    }, [sum])

    const submittedChecklistAtLabel = useMemo(() => {
        if (!chk?.submitted_at) return ''
        try {
            return new Date(chk.submitted_at).toLocaleString()
        } catch {
            return String(chk.submitted_at)
        }
    }, [chk])

    // ---------- Patient / admission meta for header ----------
    const admissionNo =
        admission?.display_code ||
        admission?.admission_code ||
        sum?.admission_no ||
        sum?.admission_code ||
        ''

    const patientCode =
        patient?.uhid || patient?.patient_code || sum?.patient_code || sum?.uhid || ''

    const bedLabel =
        admission?.bed_label || admission?.bed_code || sum?.bed_label || sum?.bed_code || ''

    const patientName = patient
        ? [patient.prefix, patient.first_name, patient.last_name].filter(Boolean).join(' ')
        : ''

    const ageVal = patient?.age_years ?? patient?.age ?? null
    const sexVal = patient?.gender || patient?.sex || ''
    const ageSex = [ageVal != null ? `${ageVal} yrs` : null, sexVal]
        .filter(Boolean)
        .join(' / ')

    const wardName =
        admission?.ward_name || admission?.ward || admission?.ward_display || ''

    // ---------- Medication helpers ----------
    function formatMedicationLine(m) {
        if (!m) return ''
        const name = m.drug_name || m.medicine_name || m.item_name || ''
        const strength = m.strength || ''
        const dose =
            m.dose != null && m.dose !== ''
                ? `${m.dose}${m.dose_unit ? ` ${m.dose_unit}` : ''}`
                : ''
        const freq = m.frequency_label || m.frequency || m.freq || ''
        const route = m.route || ''
        const duration =
            m.duration_days != null && m.duration_days !== ''
                ? `${m.duration_days} days`
                : m.duration || ''

        const parts = [
            name,
            strength && `(${strength})`,
            dose && `Dose: ${dose}`,
            freq && `Freq: ${freq}`,
            route && `Route: ${route}`,
            duration && `For ${duration}`,
        ].filter(Boolean)

        return parts.join(' • ')
    }

    const medicationSummaryText = useMemo(
        () =>
            Array.isArray(medList) && medList.length
                ? medList.map(formatMedicationLine).filter(Boolean).join('\n')
                : '',
        [medList]
    )

    const handleUseMedicationSummary = () => {
        if (readOnly) return
        if (!medicationSummaryText) {
            toast.info('No active medications found for this admission.')
            return
        }
        setFs((s) => ({
            ...s,
            medications: medicationSummaryText,
        }))
        toast.success('Discharge medications auto-filled from IPD medication chart.')
    }

    // --------- Load from API ----------
    const load = async () => {
        if (!admissionId) return
        setErr('')
        try {
            const [s, c] = await Promise.all([
                getDischargeSummary(admissionId),
                getDischargeChecklist(admissionId),
            ])

            const sd = s?.data || null
            setSum(sd)

            if (sd) {
                setAutoFollowUp(!!(sd.follow_up && sd.follow_up.trim()))

                setFs((prev) => ({
                    ...prev,
                    medical_history: sd.medical_history || '',
                    treatment_summary: sd.treatment_summary || '',
                    medications: sd.medications || '',
                    follow_up: sd.follow_up || '',
                    icd10_codes: sd.icd10_codes || '',
                    final_diagnosis_primary: sd.final_diagnosis_primary || '',
                    final_diagnosis_secondary: sd.final_diagnosis_secondary || '',
                    hospital_course: sd.hospital_course || '',
                    discharge_condition: sd.discharge_condition || 'stable',
                    discharge_type: sd.discharge_type || 'routine',
                    allergies: sd.allergies || '',
                    procedures: sd.procedures || '',
                    investigations: sd.investigations || '',
                    diet_instructions: sd.diet_instructions || '',
                    activity_instructions: sd.activity_instructions || '',
                    warning_signs: sd.warning_signs || '',
                    referral_details: sd.referral_details || '',
                    insurance_details: sd.insurance_details || '',
                    stay_summary: sd.stay_summary || '',
                    implants: sd.implants || '',
                    pending_reports: sd.pending_reports || '',
                    patient_education: sd.patient_education || '',
                    followup_appointment_ref: sd.followup_appointment_ref || '',
                    prepared_by_name: sd.prepared_by_name || '',
                    reviewed_by_name: sd.reviewed_by_name || '',
                    reviewed_by_regno: sd.reviewed_by_regno || '',
                    discharge_datetime: toInputDateTime(sd.discharge_datetime),
                    patient_ack_name: sd.patient_ack_name || '',
                    patient_ack_datetime: toInputDateTime(sd.patient_ack_datetime),
                    finalize: false, // checkbox is only an action
                }))
            } else {
                setAutoFollowUp(false)
            }

            const cd = c?.data || null
            setChk(cd)
            if (cd) {
                setFc({
                    financial_clearance: !!cd.financial_clearance,
                    clinical_clearance: !!cd.clinical_clearance,
                    delay_reason: cd.delay_reason || '',
                    submit: false,
                })
            }

            // Load IPD medications for this admission (for discharge auto-fill)
            try {
                const medsRes = await listDischargeMeds(admissionId)
                console.log("``````````````````````````````````````````");
                console.log(medsRes);
                console.log("``````````````````````````````````````````");

                const medsData = Array.isArray(medsRes?.data) ? medsRes.data : []
                setMedList(medsData)
            } catch (medErr) {
                // Soft-fail if meds not available
                console.error('Failed to load IPD medications for discharge', medErr)
            }
        } catch (e) {
            const msg =
                e?.response?.data?.detail ||
                e?.message ||
                'Failed to load discharge data'
            setErr(msg)
            toast.error(msg)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    // --------- Save handlers ----------
    const saveSummary = async (e) => {
        e.preventDefault()
        if (!admissionId) return

        if (fs.finalize && !finalized) {
            const ok = window.confirm(
                'Once finalized, this discharge summary cannot be edited. Do you want to continue?'
            )
            if (!ok) return
        }

        setSavingSummary(true)
        setErr('')
        try {
            // Convert datetime-local back to ISO
            const payload = {
                ...fs,
                discharge_datetime: toIsoSecs(fs.discharge_datetime),
                patient_ack_datetime: toIsoSecs(fs.patient_ack_datetime),
            }
            await saveDischargeSummary(admissionId, payload)
            await load()
            if (fs.finalize && !finalized) {
                toast.success(
                    'Discharge summary finalized successfully. You can now print and hand over to the patient.'
                )
            } else {
                toast.success('Discharge draft saved successfully.')
            }
        } catch (e1) {
            const msg =
                e1?.response?.data?.detail ||
                e1?.message ||
                'Failed to save discharge summary'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSavingSummary(false)
        }
    }

    const saveChecklist = async (e) => {
        e.preventDefault()
        if (!admissionId) return
        setSavingChecklist(true)
        setErr('')
        try {
            await saveDischargeChecklist(admissionId, { ...fc })
            await load()
            toast.success('Discharge checklist submitted successfully.')
        } catch (e1) {
            const msg =
                e1?.response?.data?.detail ||
                e1?.message ||
                'Failed to save checklist'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSavingChecklist(false)
        }
    }

    const handleFsChange = (field) => (e) => {
        const value =
            e?.target?.type === 'checkbox' ? e.target.checked : e.target.value

        if (field === 'follow_up') {
            setAutoFollowUp(false)
        }

        setFs((s) => ({ ...s, [field]: value }))
    }

    const handleFcChange = (field) => (e) => {
        const value =
            e?.target?.type === 'checkbox' ? e.target.checked : e.target.value
        setFc((s) => ({ ...s, [field]: value }))
    }

    // const onDownloadPdf = () => {
    //     if (!admissionId) return
    //     // Backend route:
    //     // GET /api/ipd/admissions/{admission_id}/discharge-summary/pdf
    //     window.open(
    //         `/api/ipd/admissions/${admissionId}/discharge-summary/pdf`,
    //         '_blank'
    //     )
    // }

    const onDownloadPdf = async () => {
        if (!admissionId) return

        try {
            // IMPORTANT:
            // If your API baseURL is "http://127.0.0.1:8000/api"
            // then DO NOT prefix with /api here
            const res = await API.get(
                `/ipd/admissions/${admissionId}/discharge-summary/pdf`,
                {
                    responseType: 'blob', // tells axios we're expecting binary PDF
                }
            )

            const blob = new Blob([res.data], { type: 'application/pdf' })
            const url = window.URL.createObjectURL(blob)

            // Option 1: direct download
            const link = document.createElement('a')
            link.href = url
            link.download = `discharge-summary-${admissionId}.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)

            // Option 2 (instead of above): open in new tab as viewer
            // window.open(url, '_blank')

        } catch (e) {
            console.error('PDF download error:', e)
            const msg =
                e?.response?.data?.detail ||
                (e?.response?.status === 401
                    ? 'Session expired. Please login again.'
                    : 'Failed to download discharge summary PDF.')
            alert(msg) // or use your toast system
        }
    }

    // ---------- ICD-10 helpers ----------
    const syncIcdSuggestions = (term) => {
        const q = term.trim().toLowerCase()
        if (!q) {
            setIcdSuggestions(ICD10_SAMPLE)
            return
        }
        setIcdSuggestions(
            ICD10_SAMPLE.filter(
                (it) =>
                    it.code.toLowerCase().includes(q) ||
                    it.name.toLowerCase().includes(q)
            )
        )
    }

    const handleIcdSearchChange = (e) => {
        const v = e.target.value
        setIcdSearch(v)
        syncIcdSuggestions(v)
    }

    const handleAddIcdCode = (item) => {
        if (!item) return
        const current = (fs.icd10_codes || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        const label = `${item.code} – ${item.name}`
        if (!current.includes(label)) {
            current.push(label)
        }
        setFs((s) => ({ ...s, icd10_codes: current.join('\n') }))
        toast.success(`Added ICD-10: ${label}`)
    }

    const handleRemoveIcdLine = (line) => {
        const current = (fs.icd10_codes || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        const next = current.filter((l) => l !== line)
        setFs((s) => ({ ...s, icd10_codes: next.join('\n') }))
    }

    const finalizedBadge = finalized ? (
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">
            Finalized {finalizedAtLabel && `· ${finalizedAtLabel}`}
        </span>
    ) : (
        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
            Draft – Not yet finalized
        </span>
    )

    return (
        <div className="space-y-4 text-sm text-black">
            {/* Global status / header */}
            <div className="flex flex-col gap-2 rounded-2xl border bg-gradient-to-r from-sky-50 to-emerald-50 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="text-xs font-semibold text-sky-900">
                        Discharge – Medico-Legal Summary
                    </div>
                    <div className="text-[11px] text-slate-600">
                        Capture final diagnosis, hospital course, instructions & clearances
                        as per NABH / medico-legal best practice.
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {finalizedBadge}
                    <button
                        type="button"
                        onClick={onDownloadPdf}
                        className="btn btn-sm whitespace-nowrap"
                    >
                        Download Discharge PDF
                    </button>
                </div>
            </div>

            {/* Role-based helper prompts */}
            <div className="grid gap-2 md:grid-cols-3">
                <PermGate anyOf={['ipd.doctor']}>
                    <div className="rounded-xl border bg-white p-2.5 text-[11px] text-slate-700">
                        <div className="mb-0.5 font-semibold">Doctor view</div>
                        <div>
                            Please complete <strong>diagnosis</strong>,{' '}
                            <strong>hospital course</strong>,{' '}
                            <strong>discharge medications</strong>, and approve discharge.
                        </div>
                    </div>
                </PermGate>
                <PermGate anyOf={['ipd.nurse']}>
                    <div className="rounded-xl border bg-white p-2.5 text-[11px] text-slate-700">
                        <div className="mb-0.5 font-semibold">Nurse view</div>
                        <div>
                            Please complete nursing checklist, education, vitals & pending
                            reports before discharge.
                        </div>
                    </div>
                </PermGate>
                <PermGate anyOf={['billing.manage', 'billing.view']}>
                    <div className="rounded-xl border bg-white p-2.5 text-[11px] text-slate-700">
                        <div className="mb-0.5 font-semibold">Billing view</div>
                        <div>
                            Confirm all bills and insurance claims are settled to enable final
                            discharge.
                        </div>
                    </div>
                </PermGate>
            </div>

            {/* Admission / patient / bed quick info strip (read-only view) */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-2xl border bg-white px-3 py-2 text-[11px] md:text-xs">
                <div>
                    <span className="font-semibold text-slate-700">Admission:</span>{' '}
                    <span className="text-slate-800">{admissionNo || admissionId || '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Patient:</span>{' '}
                    <span className="text-slate-800">
                        {patientName || patientCode || '—'}
                    </span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">UHID:</span>{' '}
                    <span className="text-slate-800">{patientCode || '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Age / Sex:</span>{' '}
                    <span className="text-slate-800">{ageSex || '—'}</span>
                </div>
                <div>
                    <span className="font-semibold text-slate-700">Ward / Bed:</span>{' '}
                    <span className="text-slate-800">
                        {[wardName, bedLabel].filter(Boolean).join(' / ') || '—'}
                    </span>
                </div>
                <div className="mt-1 w-full text-[10px] text-slate-500 md:mt-0 md:w-auto">
                    Patient demographics are auto-filled from IPD admission. Editing not
                    allowed in this screen.
                </div>
            </div>

            {err && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {err}
                </div>
            )}

            <PermGate anyOf={['ipd.manage', 'ipd.doctor']}>
                <div className="grid gap-4 lg:grid-cols-3">
                    {/* LEFT – Clinical narrative (2/3) */}
                    <form
                        onSubmit={saveSummary}
                        className="lg:col-span-2 space-y-4 rounded-2xl border bg-white p-3 md:p-4"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-slate-800">
                                Discharge Summary – Clinical Details
                            </h2>
                            {savingSummary && (
                                <span className="text-[11px] text-gray-500">Saving…</span>
                            )}
                        </div>

                        {/* Medical history only (Demographics removed, now from props/back-end) */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-gray-600">
                                    Medical history
                                </label>
                                <span className="text-[10px] text-gray-400">
                                    Select known conditions or type to add new history (Diabetes,
                                    HTN, Asthma, Surgery, Smoking, Alcohol, etc.)
                                </span>
                            </div>
                            <textarea
                                className="input min-h-[60px]"
                                placeholder="Known diabetes, hypertension, CAD, past surgeries, addictions…"
                                value={fs.medical_history}
                                onChange={handleFsChange('medical_history')}
                                disabled={readOnly}
                            />
                        </div>

                        {/* A. MUST-HAVE – Final diagnosis + hospital course */}
                        <div className="space-y-3 rounded-xl border bg-slate-50/80 p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-700">
                                    A. Final Diagnosis & Hospital Course
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    Core medico-legal section
                                </span>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Final primary diagnosis
                                    </label>
                                    <input
                                        className="input"
                                        placeholder="Search diagnosis by name or ICD-10 code (e.g., Dengue, A90)"
                                        value={fs.final_diagnosis_primary}
                                        onChange={handleFsChange('final_diagnosis_primary')}
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Secondary / comorbid diagnoses
                                    </label>
                                    <input
                                        className="input"
                                        placeholder="Add comorbid conditions (optional)"
                                        value={fs.final_diagnosis_secondary}
                                        onChange={handleFsChange('final_diagnosis_secondary')}
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">
                                    Hospital course / clinical summary
                                </label>
                                <textarea
                                    className="input min-h-[90px]"
                                    placeholder="Brief day-wise summary of treatment, response & complications (if any)…"
                                    value={fs.hospital_course}
                                    onChange={handleFsChange('hospital_course')}
                                    disabled={readOnly}
                                />
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Discharge condition
                                    </label>
                                    <select
                                        className="input"
                                        value={fs.discharge_condition}
                                        onChange={handleFsChange('discharge_condition')}
                                        disabled={readOnly}
                                    >
                                        <option value="stable">Stable</option>
                                        <option value="improved">Improved</option>
                                        <option value="unchanged">Unchanged</option>
                                        <option value="dama">DAMA</option>
                                        <option value="expired">Expired</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Discharge type
                                    </label>
                                    <select
                                        className="input"
                                        value={fs.discharge_type}
                                        onChange={handleFsChange('discharge_type')}
                                        disabled={readOnly}
                                    >
                                        <option value="routine">Routine</option>
                                        <option value="dama">DAMA</option>
                                        <option value="lama">LAMA</option>
                                        <option value="referred">Referred</option>
                                        <option value="absconded">Absconded</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">
                                    Allergies
                                </label>
                                <textarea
                                    className="input min-h-[60px]"
                                    placeholder="Search allergy or select ‘NKDA’ if no known allergies"
                                    value={fs.allergies}
                                    onChange={handleFsChange('allergies')}
                                    disabled={readOnly}
                                />
                                <div className="flex flex-wrap gap-2 pt-1 text-[10px]">
                                    <button
                                        type="button"
                                        className="rounded-full border px-2 py-0.5 text-[10px]"
                                        onClick={() =>
                                            !readOnly &&
                                            setFs((s) => ({
                                                ...s,
                                                allergies: 'No known drug allergy (NKDA)',
                                            }))
                                        }
                                    >
                                        ✔ Set NKDA
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* B. Procedures, investigations, instructions */}
                        <div className="space-y-3 rounded-xl border bg-slate-50/40 p-3">
                            <div className="text-xs font-semibold text-slate-700">
                                B. Procedures, Investigations & Instructions
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Procedures / surgeries performed
                                    </label>
                                    <textarea
                                        className="input min-h-[70px]"
                                        placeholder="Search and select performed procedures, then summarise (procedure, date, surgeon…)"
                                        value={fs.procedures}
                                        onChange={handleFsChange('procedures')}
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Investigation highlights
                                    </label>
                                    <textarea
                                        className="input min-h-[70px]"
                                        placeholder="Select key abnormal reports to display (labs, imaging) and summarise here…"
                                        value={fs.investigations}
                                        onChange={handleFsChange('investigations')}
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Diet instructions
                                    </label>
                                    <select
                                        className="input"
                                        value={fs.diet_instructions}
                                        onChange={handleFsChange('diet_instructions')}
                                        disabled={readOnly}
                                    >
                                        <option value="">Select diet</option>
                                        <option value="normal">Normal diet</option>
                                        <option value="soft">Soft diet</option>
                                        <option value="diabetic">Diabetic diet</option>
                                        <option value="renal">Renal diet</option>
                                        <option value="cardiac">Cardiac diet</option>
                                        <option value="other">Other / see notes</option>
                                    </select>
                                    <div className="text-[10px] text-gray-400">
                                        Select recommended discharge diet; details will appear in
                                        the summary.
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Activity instructions
                                    </label>
                                    <select
                                        className="input"
                                        value={fs.activity_instructions}
                                        onChange={handleFsChange('activity_instructions')}
                                        disabled={readOnly}
                                    >
                                        <option value="">Select activity</option>
                                        <option value="bed_rest">Bed rest</option>
                                        <option value="assisted_walk">
                                            Assisted walking / short walks
                                        </option>
                                        <option value="normal_activity">
                                            Normal activity as tolerated
                                        </option>
                                        <option value="avoid_heavy_lifting">
                                            Avoid heavy lifting / strenuous activity
                                        </option>
                                        <option value="other">Other / see notes</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">
                                    Warning / red-flag symptoms
                                </label>
                                <textarea
                                    className="input min-h-[60px]"
                                    placeholder="Select symptoms that require immediate hospital visit and list here…"
                                    value={fs.warning_signs}
                                    onChange={handleFsChange('warning_signs')}
                                    disabled={readOnly}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">
                                    Referral / transfer details (if referred)
                                </label>
                                <textarea
                                    className="input min-h-[60px]"
                                    placeholder="Search referred hospital / doctor and note reason for transfer…"
                                    value={fs.referral_details}
                                    onChange={handleFsChange('referral_details')}
                                    disabled={readOnly}
                                />
                            </div>
                        </div>

                        {/* Medications & follow up */}
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-xs font-medium text-gray-600">
                                        Discharge medications
                                    </label>
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={handleUseMedicationSummary}
                                            className="rounded-full border px-2 py-0.5 text-[10px] text-sky-700 hover:bg-sky-50"
                                        >
                                            Use IPD medication chart
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    className="input min-h-[70px]"
                                    placeholder="Search drug name to auto-fill dose & frequency, then summarise (name, dose, frequency, duration)…"
                                    value={fs.medications}
                                    onChange={handleFsChange('medications')}
                                    disabled={readOnly}
                                />
                                {Array.isArray(medList) && medList.length > 0 && (
                                    <div className="mt-1 rounded-lg border bg-slate-50 p-2">
                                        <div className="mb-1 text-[10px] text-slate-500">
                                            IPD medication chart (preview):
                                        </div>
                                        <ul className="max-h-32 space-y-0.5 overflow-auto text-[11px] text-slate-700">
                                            {medList.slice(0, 10).map((m, idx) => (
                                                <li key={m.id || idx}>{formatMedicationLine(m)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-gray-600">
                                        Follow-up advice
                                    </label>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-400">
                                            Follow-up auto-linked from OPD appointment (backend).
                                        </span>
                                        {autoFollowUp && !finalized && (
                                            <span className="text-[10px] text-emerald-600">
                                                Auto-filled from records · editable
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <textarea
                                    className="input min-h-[70px]"
                                    placeholder="Follow-up date, department, OPD number, additional instructions…"
                                    value={fs.follow_up}
                                    onChange={handleFsChange('follow_up')}
                                    disabled={readOnly}
                                />
                            </div>
                        </div>

                        {/* E. Safety & quality: implants, pending reports, education, follow-up token */}
                        <div className="space-y-3 rounded-xl border bg-slate-50/60 p-3">
                            <div className="text-xs font-semibold text-slate-700">
                                E. Safety & Quality
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Implants used (if any)
                                    </label>
                                    <textarea
                                        className="input min-h-[50px]"
                                        placeholder="Search implant by name or serial number (optional), then record details here…"
                                        value={fs.implants}
                                        onChange={handleFsChange('implants')}
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Pending reports
                                    </label>
                                    <textarea
                                        className="input min-h-[50px]"
                                        placeholder="Select pending test reports and note how / when patient will receive them…"
                                        value={fs.pending_reports}
                                        onChange={handleFsChange('pending_reports')}
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Patient education provided
                                    </label>
                                    <textarea
                                        className="input min-h-[60px]"
                                        placeholder="Select education provided (wound care, insulin injection, physiotherapy, lifestyle advice…) and summarise here…"
                                        value={fs.patient_education}
                                        onChange={handleFsChange('patient_education')}
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Follow-up appointment ID / token
                                    </label>

                                    {hasFollowupOptions ? (
                                        <select
                                            className="input"
                                            value={fs.followup_appointment_ref}
                                            onChange={handleFsChange('followup_appointment_ref')}
                                            disabled={readOnly || loadingFollowups}
                                        >
                                            <option value="">
                                                {loadingFollowups
                                                    ? 'Loading follow-ups…'
                                                    : 'Select linked OPD follow-up'}
                                            </option>
                                            {followupOptions.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            className="input"
                                            placeholder="Linked OPD appointment ID / token"
                                            value={fs.followup_appointment_ref}
                                            onChange={handleFsChange('followup_appointment_ref')}
                                            disabled={readOnly}
                                        />
                                    )}

                                    <div className="text-[10px] text-gray-400">
                                        Dropdown will show OPD follow-ups for this patient (to be
                                        wired from OPD module).
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ICD codes + finalize line */}
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">
                                    ICD-10 codes
                                </label>

                                {/* Search + suggestions */}
                                <div className="space-y-1 rounded-lg border bg-slate-50/70 p-2">
                                    <div className="mb-1 text-[11px] text-slate-600">
                                        Search ICD-10 by diagnosis name or code (e.g., "Dengue" →
                                        A90). Start typing to see suggestions.
                                    </div>
                                    <input
                                        className="input h-8 text-[12px]"
                                        placeholder='Type to search… (e.g., "dengue", "A90")'
                                        value={icdSearch}
                                        onChange={handleIcdSearchChange}
                                        disabled={readOnly}
                                    />
                                    {!readOnly && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {icdSuggestions.length === 0 && (
                                                <span className="text-[10px] text-slate-400">
                                                    No matches. Try a different spelling.
                                                </span>
                                            )}
                                            {icdSuggestions.map((item) => (
                                                <button
                                                    key={item.code}
                                                    type="button"
                                                    className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-slate-100"
                                                    onClick={() => handleAddIcdCode(item)}
                                                >
                                                    {item.code} – {item.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selected ICD-10 list (stored as simple lines, not CSV/JSON) */}
                                <textarea
                                    className="input mt-2 min-h-[70px] text-[12px]"
                                    placeholder="Selected ICD-10 codes will appear here, one per line (e.g., A90 – Dengue fever)."
                                    value={fs.icd10_codes}
                                    onChange={handleFsChange('icd10_codes')}
                                    disabled={readOnly}
                                />
                                {!readOnly && fs.icd10_codes && (
                                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
                                        {(fs.icd10_codes || '')
                                            .split('\n')
                                            .map((l) => l.trim())
                                            .filter(Boolean)
                                            .map((line) => (
                                                <button
                                                    key={line}
                                                    type="button"
                                                    className="rounded-full border px-2 py-0.5 hover:bg-rose-50"
                                                    onClick={() => handleRemoveIcdLine(line)}
                                                >
                                                    ✕ {line}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2 border-t pt-2 text-xs text-gray-600 md:flex-row md:items-center md:justify-between">
                                <div>
                                    {finalized ? (
                                        <span>
                                            Finalized at{' '}
                                            <span className="font-medium text-emerald-700">
                                                {finalizedAtLabel}
                                            </span>
                                        </span>
                                    ) : (
                                        <span>
                                            Fill mandatory details before finalizing. Once finalized,
                                            this summary cannot be edited.
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {!finalized && (
                                        <label className="inline-flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4"
                                                checked={fs.finalize}
                                                onChange={handleFsChange('finalize')}
                                                disabled={readOnly}
                                            />
                                            <span className="text-xs">Mark as finalized</span>
                                        </label>
                                    )}
                                    <button
                                        className="btn"
                                        disabled={savingSummary || finalized || !canWrite}
                                    >
                                        {savingSummary ? 'Saving…' : 'Save summary'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>

                    {/* RIGHT – Admin / billing / acknowledgement */}
                    <div className="space-y-4">
                        {/* C. Operational / billing support */}
                        <form
                            onSubmit={saveChecklist}
                            className="space-y-4 rounded-2xl border bg-white p-3 md:p-4"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-sm font-semibold text-slate-800">
                                    Discharge Checklist & Clearance
                                </h2>
                                {savingChecklist && (
                                    <span className="text-[11px] text-gray-500">Saving…</span>
                                )}
                            </div>

                            <div className="space-y-2 rounded-xl bg-slate-50/80 p-3">
                                <div className="text-[11px] font-medium text-slate-700">
                                    Financial & clinical clearance
                                </div>
                                <label className="flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={fc.financial_clearance}
                                        onChange={handleFcChange('financial_clearance')}
                                    />
                                    <span>
                                        Financial clearance completed – confirm all bills and
                                        insurance claims are settled.
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={fc.clinical_clearance}
                                        onChange={handleFcChange('clinical_clearance')}
                                    />
                                    <span>Clinical discharge clearance given by doctor.</span>
                                </label>
                                <input
                                    className="input mt-1"
                                    placeholder="Delay reason (if any)"
                                    value={fc.delay_reason}
                                    onChange={handleFcChange('delay_reason')}
                                />
                            </div>

                            <div className="space-y-3 rounded-xl bg-slate-50/80 p-3">
                                <div className="text-[11px] font-medium text-slate-700">
                                    Insurance / TPA & stay summary
                                </div>
                                <textarea
                                    className="input min-h-[70px]"
                                    placeholder="Payer name, claim number, pre-auth number, claim status…"
                                    value={fs.insurance_details}
                                    onChange={handleFsChange('insurance_details')}
                                    disabled={readOnly}
                                />
                                <textarea
                                    className="input min-h-[60px]"
                                    placeholder="Total days admitted, ICU days (if any), ward type (general / semi-private / private)…"
                                    value={fs.stay_summary}
                                    onChange={handleFsChange('stay_summary')}
                                    disabled={readOnly}
                                />
                            </div>

                            <div className="space-y-3 rounded-xl bg-slate-50/80 p-3">
                                <div className="text-[11px] font-medium text-slate-700">
                                    Patient acknowledgement
                                </div>
                                <input
                                    className="input"
                                    placeholder="Patient / attendant name"
                                    value={fs.patient_ack_name}
                                    onChange={handleFsChange('patient_ack_name')}
                                    disabled={readOnly}
                                />
                                <div className="space-y-1">
                                    <label className="text-[11px] text-gray-600">
                                        Acknowledgement date & time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="input"
                                        value={fs.patient_ack_datetime}
                                        onChange={handleFsChange('patient_ack_datetime')}
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 rounded-xl bg-slate-50/80 p-3">
                                <div className="text-[11px] font-medium text-slate-700">
                                    Doctor & system validation
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] text-gray-600">
                                        Prepared by (nurse / junior doctor)
                                    </label>
                                    <input
                                        className="input"
                                        placeholder="Name of nurse / intern"
                                        value={fs.prepared_by_name}
                                        onChange={handleFsChange('prepared_by_name')}
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] text-gray-600">
                                        Reviewed & approved by
                                    </label>
                                    <input
                                        className="input mb-1"
                                        placeholder="Consultant doctor name"
                                        value={fs.reviewed_by_name}
                                        onChange={handleFsChange('reviewed_by_name')}
                                        disabled={readOnly}
                                    />
                                    <input
                                        className="input"
                                        placeholder="Registration number"
                                        value={fs.reviewed_by_regno}
                                        onChange={handleFsChange('reviewed_by_regno')}
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] text-gray-600">
                                        Discharge date & time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="input"
                                        value={fs.discharge_datetime}
                                        onChange={handleFsChange('discharge_datetime')}
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    Clinical clearance confirms the patient is medically fit for
                                    discharge.
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t pt-2 text-xs">
                                <label className="inline-flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={fc.submit}
                                        onChange={handleFcChange('submit')}
                                    />
                                    <span>Submit discharge checklist</span>
                                </label>
                                <button className="btn" disabled={savingChecklist}>
                                    {savingChecklist ? 'Saving…' : 'Save checklist'}
                                </button>
                            </div>

                            {chk?.submitted && (
                                <div className="text-[11px] text-emerald-700">
                                    Checklist submitted at{' '}
                                    <span className="font-medium">
                                        {submittedChecklistAtLabel}
                                    </span>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </PermGate>
        </div>
    )
}
