// FILE: src/patients/PatientForm.jsx
import { useEffect, useMemo, useState } from 'react'
import { createPatient, updatePatient } from '../api/patients'
import { useBranding } from '../branding/BrandingProvider'
import { X, ChevronDown, ChevronUp } from 'lucide-react'

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const MARITAL_STATUSES = ['', 'Single', 'Married', 'Widowed', 'Divorced']
const PREFIXES = ['', 'Mr', 'Ms', 'Mrs', 'Dr', 'Baby', 'Master']

const PATIENT_TYPES_FALLBACK = [
    { code: 'OPD', name: 'OPD' },
    { code: 'IPD', name: 'IPD' },
    { code: 'EMERGENCY', name: 'Emergency' },
    { code: 'HEALTH_CHECK', name: 'Health Check' },
    { code: 'CAMP', name: 'Camp' },
    { code: 'CORPORATE', name: 'Corporate' },
    { code: 'INSURANCE', name: 'Insurance' },
]

const CREDIT_TYPES = ['', 'insurance', 'corporate', 'govt', 'other']

const EMPTY_FORM = {
    // Mandatory-first
    prefix: '',
    first_name: '',
    last_name: '',
    gender: '',
    dob: '',
    patient_type: '',
    marital_status: '',
    phone: '',
    email: '',
    ref_source: '',
    ref_doctor_id: '',
    ref_details: '',

    // Optional
    blood_group: '',
    tag: '',
    religion: '',
    occupation: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_relation: '',
    id_proof_type: '',
    id_proof_no: '',
    file_number: '',
    file_location: '',
    credit_type: '',
    credit_payer_id: '',
    credit_tpa_id: '',
    credit_plan_id: '',
    principal_member_name: '',
    principal_member_address: '',
    policy_number: '',
    policy_name: '',
    family_id: '',
    address: {
        type: 'current',
        line1: '',
        line2: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
    },
}

function makeEmptyForm() {
    return JSON.parse(JSON.stringify(EMPTY_FORM))
}

function mapPatientToForm(p) {
    if (!p) return makeEmptyForm()
    const addr = (p.addresses && p.addresses[0]) || null
    return {
        prefix: p.prefix || '',
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        gender: p.gender || '',
        dob: p.dob || '',
        patient_type: p.patient_type || '',
        marital_status: p.marital_status || '',
        phone: p.phone || '',
        email: p.email || '',
        ref_source: p.ref_source || '',
        ref_doctor_id: p.ref_doctor_id ? String(p.ref_doctor_id) : '__NA__',
        ref_details: p.ref_details || '',

        blood_group: p.blood_group || '',
        tag: p.tag || '',
        religion: p.religion || '',
        occupation: p.occupation || '',
        guardian_name: p.guardian_name || '',
        guardian_phone: p.guardian_phone || '',
        guardian_relation: p.guardian_relation || '',
        id_proof_type: p.id_proof_type || '',
        id_proof_no: p.id_proof_no || '',
        file_number: p.file_number || '',
        file_location: p.file_location || '',
        credit_type: p.credit_type || '',
        credit_payer_id: p.credit_payer_id || '',
        credit_tpa_id: p.credit_tpa_id || '',
        credit_plan_id: p.credit_plan_id || '',
        principal_member_name: p.principal_member_name || '',
        principal_member_address: p.principal_member_address || '',
        policy_number: p.policy_number || '',
        policy_name: p.policy_name || '',
        family_id: p.family_id || '',
        address: {
            type: addr?.type || 'current',
            line1: addr?.line1 || '',
            line2: addr?.line2 || '',
            city: addr?.city || '',
            state: addr?.state || '',
            pincode: addr?.pincode || '',
            country: addr?.country || 'India',
        },
    }
}

function toIntOrNull(val) {
    if (val === undefined || val === null || val === '') return null
    const n = Number(val)
    return Number.isNaN(n) ? null : n
}

function parseApiError(err) {
    let generalMessage = 'Failed to save patient'
    const fieldErrors = {}
    const detail = err?.response?.data?.detail

    if (Array.isArray(detail)) {
        generalMessage = 'Please correct the highlighted fields.'
        for (const e of detail) {
            const loc = e.loc || []
            const msg = e.msg || 'Invalid value'
            if (loc[0] === 'body' && loc.length >= 2) {
                if (loc[1] === 'address' && loc[2]) {
                    const field = `address.${loc[2]}`
                    fieldErrors[field] = fieldErrors[field] ? `${fieldErrors[field]}; ${msg}` : msg
                } else {
                    const field = loc[1]
                    fieldErrors[field] = fieldErrors[field] ? `${fieldErrors[field]}; ${msg}` : msg
                }
            }
        }
        if (!Object.keys(fieldErrors).length && detail[0]?.msg) generalMessage = detail[0].msg
    } else if (typeof detail === 'string') generalMessage = detail
    else if (detail && typeof detail === 'object' && detail.msg) generalMessage = detail.msg
    else if (err?.message) generalMessage = err.message

    return { generalMessage, fieldErrors }
}

const isEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v || '').trim())
const isPhone10 = (v) => /^\d{10}$/.test(String(v || '').trim())
const safeHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
const alpha = (hex, a = '1A') => (safeHex(hex) ? `${hex}${a}` : undefined)

/** Hook-safe wrapper */
export default function PatientFormModal(props) {
    if (!props.open) return null
    return <PatientFormModalInner {...props} />
}

function PatientFormModalInner({ onClose, onSaved, initialPatient, lookups }) {
    const { branding } = useBranding() || {}
    const primary = safeHex(branding?.primary_color) ? branding.primary_color : '#007AFF' // NUTRYAH-ish blue
    const ring = alpha(primary, '33') || 'rgba(0,122,255,.20)'

    const mode = useMemo(() => (initialPatient ? 'edit' : 'create'), [initialPatient])

    const [form, setForm] = useState(() => (initialPatient ? mapPatientToForm(initialPatient) : makeEmptyForm()))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [fieldErrors, setFieldErrors] = useState({})
    const [touched, setTouched] = useState({})

    const [openOpt, setOpenOpt] = useState({
        optionalBasics: false,
        address: false,
        guardian: false,
        idproof: false,
        credit: false,
        file: false,
    })

    const { refSources, doctors, payers, tpas, creditPlans, patientTypes } = lookups || {}
    const patientTypeOptions = patientTypes?.length ? patientTypes : PATIENT_TYPES_FALLBACK

    useEffect(() => {
        setError('')
        setFieldErrors({})
        setTouched({})
        setForm(initialPatient ? mapPatientToForm(initialPatient) : makeEmptyForm())
    }, [initialPatient])

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const REQUIRED = useMemo(
        () => ({
            prefix: (v) => !!String(v || '').trim(),
            first_name: (v) => !!String(v || '').trim(),
            gender: (v) => !!String(v || '').trim(),
            dob: (v) => !!String(v || '').trim(),
            patient_type: (v) => !!String(v || '').trim(),
            marital_status: (v) => !!String(v || '').trim(),
            phone: (v) => isPhone10(v),
        }),
        []
    )

    const completion = useMemo(() => {
        const keys = Object.keys(REQUIRED)
        const okCount = keys.filter((k) => REQUIRED[k](form[k])).length
        return { okCount, total: keys.length, ok: okCount === keys.length }
    }, [REQUIRED, form])

    const markTouched = (key) => setTouched((p) => ({ ...p, [key]: true }))

    const clearFieldError = (name) => {
        setFieldErrors((prev) => {
            if (!prev[name]) return prev
            const copy = { ...prev }
            delete copy[name]
            return copy
        })
    }

    const handleChange = (field) => (e) => {
        let value = e.target.value
        if (field === 'phone' || field === 'guardian_phone') {
            const digits = value.replace(/\D/g, '')
            value = digits.slice(0, 10)
        }
        setForm((prev) => ({ ...prev, [field]: value }))
        clearFieldError(field)
    }

    const handleAddressChange = (field) => (e) => {
        const value = e.target.value
        setForm((prev) => ({ ...prev, address: { ...prev.address, [field]: value } }))
        clearFieldError(`address.${field}`)
    }

    const validateRequired = () => {
        const fe = {}
        for (const k of Object.keys(REQUIRED)) {
            const ok = REQUIRED[k](form[k])
            if (!ok) fe[k] = 'Required'
        }
        if (Object.keys(fe).length) {
            setFieldErrors(fe)
            setTouched((p) => ({ ...p, ...Object.fromEntries(Object.keys(fe).map((k) => [k, true])) }))
            setError('Fill all mandatory fields to continue.')
            return false
        }
        return true
    }

    const handleSubmit = async (e) => {
        e?.preventDefault?.()
        setError('')
        setFieldErrors({})

        if (!validateRequired()) return

        setSaving(true)
        try {
            const payload = {
                ...form,
                ref_doctor_id: toIntOrNull(form.ref_doctor_id), // "__NA__" -> null
                credit_payer_id: toIntOrNull(form.credit_payer_id),
                credit_tpa_id: toIntOrNull(form.credit_tpa_id),
                credit_plan_id: toIntOrNull(form.credit_plan_id),
                family_id: toIntOrNull(form.family_id),
                credit_type: form.credit_type || null,
                patient_type: form.patient_type || null,
            }

            const res = mode === 'create'
                ? await createPatient(payload)
                : await updatePatient(initialPatient.id, payload)

            onSaved?.(res.data)
            onClose?.()
        } catch (err) {
            const { generalMessage, fieldErrors: fe } = parseApiError(err)
            setError(generalMessage)
            setFieldErrors(fe || {})
        } finally {
            setSaving(false)
        }
    }

    const toggle = (k) => setOpenOpt((p) => ({ ...p, [k]: !p[k] }))

    // Minimal NUTRYAH-like input styling
    const base =
        'w-full h-11 rounded-2xl border bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition shadow-sm'
    const textareaBase =
        'w-full rounded-2xl border bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition shadow-sm min-h-[96px]'

    const inputCls = (k) =>
        [
            base,
            fieldErrors[k] ? 'border-rose-300' : 'border-slate-500',
            `focus:ring-4`,
        ].join(' ')

    const textareaCls = (k) =>
        [
            textareaBase,
            fieldErrors[k] ? 'border-rose-300' : 'border-slate-500',
            `focus:ring-4`,
        ].join(' ')

    const focusStyle = { boxShadow: `0 0 0 6px ${ring}` }

    const state = (k) => {
        if (!touched[k] && !fieldErrors[k]) return 'idle'
        return REQUIRED[k] ? (REQUIRED[k](form[k]) ? 'ok' : 'bad') : 'idle'
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.()
            }}
        >
            {/* 90% width, super clean */}
            <div
                className="relative w-[90vw] max-w-[1120px] max-h-[90vh] overflow-hidden rounded-[28px] border border-slate-500 bg-white shadow-[0_40px_120px_-80px_rgba(0,0,0,.50)]"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Close (no header bar) */}
                <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="absolute right-4 top-4 h-10 w-10 rounded-2xl border border-slate-500 bg-white hover:bg-slate-50 grid place-items-center transition disabled:opacity-60"
                    title="Close"
                >
                    <X className="h-5 w-5 text-slate-700" />
                </button>

                {/* Floating actions (no footer bar) */}
                <div className="absolute right-4 bottom-4 z-10 flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-500 bg-white/90 backdrop-blur px-3 py-2">
                        <div className="text-[12px] font-semibold text-slate-700">
                            Mandatory {completion.okCount}/{completion.total}
                        </div>
                        <div className="h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                            <div
                                className="h-1.5 rounded-full"
                                style={{
                                    width: `${Math.round((completion.okCount / completion.total) * 100)}%`,
                                    backgroundColor: primary,
                                }}
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || !completion.ok}
                        className="h-11 rounded-full px-5 text-sm font-semibold text-white active:scale-[0.99] transition disabled:opacity-60"
                        style={{ backgroundColor: primary }}
                        title={!completion.ok ? 'Fill all mandatory fields' : ''}
                    >
                        {saving ? (mode === 'create' ? 'Creating…' : 'Saving…') : mode === 'create' ? 'Create' : 'Save'}
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="h-full">
                    <div className="h-[90vh] max-h-[90vh] overflow-y-auto bg-[#F5F5F7] px-5 sm:px-10 py-8">
                        {/* Minimal top text (not a header bar) */}
                        <div className="mb-6 pr-12">
                            <div className="text-[20px] sm:text-[22px] font-semibold tracking-tight text-slate-900">
                                {mode === 'create' ? 'Patient Registration' : 'Edit Patient'}
                                {initialPatient?.uhid ? (
                                    <span className="ml-2 align-middle inline-flex font-mono text-[11px] px-2 py-0.5 rounded-full border border-slate-500 bg-white text-slate-700">
                                        UHID: {initialPatient.uhid}
                                    </span>
                                ) : null}
                            </div>
                            <div className="mt-1 text-[13px] text-slate-600">
                                Start with mandatory fields. Optional sections can be completed later.
                            </div>

                            {error ? (
                                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">
                                    {error}
                                </div>
                            ) : null}
                        </div>

                        {/* Mandatory (NUTRYAH-like card) */}
                        <Section title="Mandatory fields">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Field label="Prefix *" state={state('prefix')}>
                                    <select
                                        value={form.prefix}
                                        onChange={handleChange('prefix')}
                                        onBlur={() => markTouched('prefix')}
                                        className={inputCls('prefix')}
                                        style={{ ...(touched.prefix ? focusStyle : null) }}
                                    >
                                        {PREFIXES.map((p) => (
                                            <option key={p || 'x'} value={p}>
                                                {p || 'Select'}
                                            </option>
                                        ))}
                                    </select>
                                    <Err text={fieldErrors.prefix} />
                                </Field>

                                <Field label="First Name *" state={state('first_name')}>
                                    <input
                                        value={form.first_name}
                                        onChange={handleChange('first_name')}
                                        onBlur={() => markTouched('first_name')}
                                        className={inputCls('first_name')}
                                        placeholder="Enter first name"
                                        style={{ ...(touched.first_name ? focusStyle : null) }}
                                    />
                                    <Err text={fieldErrors.first_name} />
                                </Field>

                                <Field label="Last Name">
                                    <input
                                        value={form.last_name}
                                        onChange={handleChange('last_name')}
                                        className={inputCls('__ok')}
                                        placeholder="Optional"
                                    />
                                </Field>

                                <Field label="Gender *" state={state('gender')}>
                                    <select
                                        value={form.gender}
                                        onChange={handleChange('gender')}
                                        onBlur={() => markTouched('gender')}
                                        className={inputCls('gender')}
                                        style={{ ...(touched.gender ? focusStyle : null) }}
                                    >
                                        <option value="">Select</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                    <Err text={fieldErrors.gender} />
                                </Field>

                                <Field label="DOB *" state={state('dob')}>
                                    <input
                                        type="date"
                                        value={form.dob || ''}
                                        onChange={handleChange('dob')}
                                        onBlur={() => markTouched('dob')}
                                        className={inputCls('dob')}
                                        style={{ ...(touched.dob ? focusStyle : null) }}
                                    />
                                    <Err text={fieldErrors.dob} />
                                </Field>

                                <Field label="Marital Status *" state={state('marital_status')}>
                                    <select
                                        value={form.marital_status}
                                        onChange={handleChange('marital_status')}
                                        onBlur={() => markTouched('marital_status')}
                                        className={inputCls('marital_status')}
                                        style={{ ...(touched.marital_status ? focusStyle : null) }}
                                    >
                                        {MARITAL_STATUSES.map((st) => (
                                            <option key={st || 'x'} value={st}>
                                                {st || 'Select'}
                                            </option>
                                        ))}
                                    </select>
                                    <Err text={fieldErrors.marital_status} />
                                </Field>

                                <Field label="Patient Type *" state={state('patient_type')}>
                                    <select
                                        value={form.patient_type || ''}
                                        onChange={handleChange('patient_type')}
                                        onBlur={() => markTouched('patient_type')}
                                        className={inputCls('patient_type')}
                                        style={{ ...(touched.patient_type ? focusStyle : null) }}
                                    >
                                        <option value="">Select</option>
                                        {patientTypeOptions.map((pt) => (
                                            <option key={pt.code || pt.name} value={pt.code || pt.name}>
                                                {pt.name || pt.code}
                                            </option>
                                        ))}
                                    </select>
                                    <Err text={fieldErrors.patient_type} />
                                </Field>

                                <Field label="Mobile *" state={state('phone')}>
                                    <input
                                        value={form.phone}
                                        onChange={handleChange('phone')}
                                        onBlur={() => markTouched('phone')}
                                        className={inputCls('phone')}
                                        placeholder="10 digit mobile"
                                        style={{ ...(touched.phone ? focusStyle : null) }}
                                    />
                                    <Err
                                        text={
                                            fieldErrors.phone ||
                                            (touched.phone && !isPhone10(form.phone) ? 'Enter valid 10 digit mobile' : '')
                                        }
                                    />
                                </Field>

                                <Field label="Email">
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={handleChange('email')}
                                        onBlur={() => markTouched('email')}
                                        className={inputCls('__ok')}
                                        placeholder="Optional"
                                    />
                                    <Err
                                        text={
                                            fieldErrors.email ||
                                            (touched.email && String(form.email || '').trim() && !isEmail(form.email)
                                                ? 'Enter valid email'
                                                : '')
                                        }
                                    />
                                </Field>


                                <Field label="Reference Source *" state={state('ref_source')}>
                                    <select
                                        value={form.ref_source}
                                        onChange={handleChange('ref_source')}
                                        onBlur={() => markTouched('ref_source')}
                                        className={inputCls('ref_source')}
                                        style={{ ...(touched.ref_source ? focusStyle : null) }}
                                    >
                                        <option value="">Select</option>
                                        {refSources?.map((src) => (
                                            <option key={src.code} value={src.code}>
                                                {src.label}
                                            </option>
                                        ))}
                                    </select>
                                    <Err text={fieldErrors.ref_source} />
                                </Field>

                                <Field label="Referring Doctor " >
                                    <select
                                        value={form.ref_doctor_id || ''}
                                        onChange={handleChange('ref_doctor_id')}
                                        onBlur={() => markTouched('ref_doctor_id')}
                                        className={inputCls('ref_doctor_id')}
                                        style={{ ...(touched.ref_doctor_id ? focusStyle : null) }}
                                    >
                                        <option value="">Select</option>
                                        <option value="__NA__">Not applicable / Walk-in</option>
                                        {doctors?.map((d) => (
                                            <option key={d.id} value={String(d.id)}>
                                                {d.name}
                                                {d.department_name ? ` (${d.department_name})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <Err text={fieldErrors.ref_doctor_id} />
                                </Field>

                                <Field label="Reference Details" className="sm:col-span-2 lg:col-span-3">
                                    <textarea
                                        value={form.ref_details}
                                        onChange={handleChange('ref_details')}
                                        onBlur={() => markTouched('ref_details')}
                                        className={textareaCls('ref_details')}
                                        placeholder="Walk-in / Google / Camp / Insurance desk / Doctor referral…"
                                        style={{ ...(touched.ref_details ? focusStyle : null) }}
                                    />
                                    <Err text={fieldErrors.ref_details} />
                                </Field>
                            </div>
                        </Section>

                        {/* Optional sections (minimal disclosure) */}
                        <div className="mt-5 grid gap-3">
                            <Disclosure
                                open={openOpt.optionalBasics}
                                onToggle={() => toggle('optionalBasics')}
                                title="Optional basics"
                                subtitle="Blood group, tag, religion, occupation"
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Blood Group">
                                        <select value={form.blood_group} onChange={handleChange('blood_group')} className={inputCls('__ok')}>
                                            {BLOOD_GROUPS.map((bg) => (
                                                <option key={bg || 'x'} value={bg}>
                                                    {bg || 'Select'}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Tag">
                                        <input value={form.tag} onChange={handleChange('tag')} className={inputCls('__ok')} placeholder="VIP / Staff / Corporate…" />
                                    </Field>
                                    <Field label="Religion">
                                        <input value={form.religion} onChange={handleChange('religion')} className={inputCls('__ok')} />
                                    </Field>
                                    <Field label="Occupation">
                                        <input value={form.occupation} onChange={handleChange('occupation')} className={inputCls('__ok')} />
                                    </Field>
                                </div>
                            </Disclosure>

                            <Disclosure open={openOpt.address} onToggle={() => toggle('address')} title="Address" subtitle="Current address details">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Address Line 1" className="sm:col-span-2">
                                        <input value={form.address.line1} onChange={handleAddressChange('line1')} className={inputCls('address.line1')} />
                                        <Err text={fieldErrors['address.line1']} />
                                    </Field>
                                    <Field label="Address Line 2" className="sm:col-span-2">
                                        <input value={form.address.line2} onChange={handleAddressChange('line2')} className={inputCls('__ok')} />
                                    </Field>
                                    <Field label="City">
                                        <input value={form.address.city} onChange={handleAddressChange('city')} className={inputCls('address.city')} />
                                        <Err text={fieldErrors['address.city']} />
                                    </Field>
                                    <Field label="State">
                                        <input value={form.address.state} onChange={handleAddressChange('state')} className={inputCls('address.state')} />
                                        <Err text={fieldErrors['address.state']} />
                                    </Field>
                                    <Field label="Pincode">
                                        <input value={form.address.pincode} onChange={handleAddressChange('pincode')} className={inputCls('address.pincode')} />
                                        <Err text={fieldErrors['address.pincode']} />
                                    </Field>
                                    <Field label="Country">
                                        <input value={form.address.country} onChange={handleAddressChange('country')} className={inputCls('__ok')} />
                                    </Field>
                                </div>
                            </Disclosure>

                            <Disclosure open={openOpt.guardian} onToggle={() => toggle('guardian')} title="Guardian" subtitle="For minor / dependent">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Guardian Name">
                                        <input value={form.guardian_name} onChange={handleChange('guardian_name')} className={inputCls('__ok')} />
                                    </Field>
                                    <Field label="Guardian Phone">
                                        <input value={form.guardian_phone} onChange={handleChange('guardian_phone')} className={inputCls('__ok')} />
                                    </Field>
                                    <Field label="Guardian Relation" className="sm:col-span-2">
                                        <input value={form.guardian_relation} onChange={handleChange('guardian_relation')} className={inputCls('__ok')} />
                                    </Field>
                                </div>
                            </Disclosure>

                            <Disclosure open={openOpt.idproof} onToggle={() => toggle('idproof')} title="ID Proof" subtitle="Aadhaar / PAN / DL">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="ID Proof Type">
                                        <input value={form.id_proof_type} onChange={handleChange('id_proof_type')} className={inputCls('__ok')} />
                                    </Field>
                                    <Field label="ID Proof No">
                                        <input value={form.id_proof_no} onChange={handleChange('id_proof_no')} className={inputCls('__ok')} />
                                    </Field>
                                </div>
                            </Disclosure>

                            <Disclosure open={openOpt.credit} onToggle={() => toggle('credit')} title="Credit / Insurance" subtitle="Only when needed">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Credit Type">
                                        <select value={form.credit_type} onChange={handleChange('credit_type')} className={inputCls('__ok')}>
                                            {CREDIT_TYPES.map((t) => (
                                                <option key={t || 'x'} value={t}>
                                                    {t || 'Select'}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="Payer">
                                        <select value={form.credit_payer_id || ''} onChange={handleChange('credit_payer_id')} className={inputCls('__ok')}>
                                            <option value="">Select</option>
                                            {payers?.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.display_name || p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="TPA">
                                        <select value={form.credit_tpa_id || ''} onChange={handleChange('credit_tpa_id')} className={inputCls('__ok')}>
                                            <option value="">Select</option>
                                            {tpas?.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.display_name || t.name}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="Credit Plan">
                                        <select value={form.credit_plan_id || ''} onChange={handleChange('credit_plan_id')} className={inputCls('__ok')}>
                                            <option value="">Select</option>
                                            {creditPlans?.map((cp) => (
                                                <option key={cp.id} value={cp.id}>
                                                    {cp.name}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="Policy Number">
                                        <input value={form.policy_number} onChange={handleChange('policy_number')} className={inputCls('__ok')} />
                                    </Field>

                                    <Field label="Policy Name">
                                        <input value={form.policy_name} onChange={handleChange('policy_name')} className={inputCls('__ok')} />
                                    </Field>

                                    <Field label="Principal Member Name" className="sm:col-span-2">
                                        <input value={form.principal_member_name} onChange={handleChange('principal_member_name')} className={inputCls('__ok')} />
                                    </Field>

                                    <Field label="Principal Member Address" className="sm:col-span-2">
                                        <textarea value={form.principal_member_address} onChange={handleChange('principal_member_address')} className={textareaCls('__ok')} />
                                    </Field>

                                    <Field label="Family ID">
                                        <input value={form.family_id} onChange={handleChange('family_id')} className={inputCls('__ok')} />
                                    </Field>
                                </div>
                            </Disclosure>

                            <Disclosure open={openOpt.file} onToggle={() => toggle('file')} title="File Details" subtitle="File number / location">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="File Number">
                                        <input value={form.file_number} onChange={handleChange('file_number')} className={inputCls('__ok')} />
                                    </Field>
                                    <Field label="File Location">
                                        <input value={form.file_location} onChange={handleChange('file_location')} className={inputCls('__ok')} />
                                    </Field>
                                </div>
                            </Disclosure>

                            {/* Spacer so floating save never overlaps */}
                            <div className="h-20" />
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* ---------- Minimal UI helpers ---------- */

function Section({ title, children }) {
    return (
        <div className="rounded-[26px] border border-slate-500 bg-white">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-500">
                <div className="text-[14px] font-semibold text-slate-900">{title}</div>
                <div className="mt-0.5 text-[12px] text-slate-600">Keep it clean. Mandatory first.</div>
            </div>
            <div className="p-5 sm:p-6">{children}</div>
        </div>
    )
}

function Disclosure({ open, onToggle, title, subtitle, children }) {
    return (
        <div className="rounded-[22px] border border-slate-500 bg-white overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="w-full px-5 sm:px-6 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
            >
                <div className="text-left">
                    <div className="text-[14px] font-semibold text-slate-900">{title}</div>
                    <div className="mt-0.5 text-[12px] text-slate-600">{subtitle}</div>
                </div>
                {open ? <ChevronUp className="h-5 w-5 text-slate-600" /> : <ChevronDown className="h-5 w-5 text-slate-600" />}
            </button>
            {open ? <div className="px-5 sm:px-6 pb-5 sm:pb-6">{children}</div> : null}
        </div>
    )
}

function Field({ label, children, state = 'idle', className = '' }) {
    return (
        <div className={className}>
            <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[12px] font-medium text-slate-800">{label}</div>
                {state === 'bad' ? <span className="text-[11px] font-semibold text-rose-600">Required</span> : null}
                {state === 'ok' ? <span className="text-[11px] font-semibold text-emerald-600">OK</span> : null}
            </div>
            {children}
        </div>
    )
}

function Err({ text }) {
    if (!text) return null
    return <div className="mt-1 text-[12px] font-medium text-rose-600">{text}</div>
}
