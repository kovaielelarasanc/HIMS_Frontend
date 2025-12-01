// FILE: src/patients/PatientFormModal.jsx
import { useEffect, useMemo, useState } from 'react';
import { createPatient, updatePatient } from '../api/patients';

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const MARITAL_STATUSES = ['', 'Single', 'Married', 'Widowed', 'Divorced'];
const PATIENT_TYPES = ['none', 'camp', 'corporate', 'insurance'];
const CREDIT_TYPES = ['', 'insurance', 'corporate', 'govt', 'other'];

const EMPTY_FORM = {
    first_name: '',
    last_name: '',
    gender: '',
    dob: '',
    phone: '',
    email: '',
    aadhar_last4: '',
    blood_group: '',
    marital_status: '',
    ref_source: '',
    ref_doctor_id: '',
    ref_details: '',
    id_proof_type: '',
    id_proof_no: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_relation: '',
    patient_type: 'none',
    tag: '',
    religion: '',
    occupation: '',
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
};

function makeEmptyForm() {
    // Simple deep clone to avoid shared reference issues
    return JSON.parse(JSON.stringify(EMPTY_FORM));
}

function mapPatientToForm(p) {
    if (!p) return makeEmptyForm();
    const addr = (p.addresses && p.addresses[0]) || null;
    return {
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        gender: p.gender || '',
        dob: p.dob || '',
        phone: p.phone || '',
        email: p.email || '',
        aadhar_last4: p.aadhar_last4 || '',
        blood_group: p.blood_group || '',
        marital_status: p.marital_status || '',
        ref_source: p.ref_source || '',
        ref_doctor_id: p.ref_doctor_id || '',
        ref_details: p.ref_details || '',
        id_proof_type: p.id_proof_type || '',
        id_proof_no: p.id_proof_no || '',
        guardian_name: p.guardian_name || '',
        guardian_phone: p.guardian_phone || '',
        guardian_relation: p.guardian_relation || '',
        patient_type: p.patient_type || 'none',
        tag: p.tag || '',
        religion: p.religion || '',
        occupation: p.occupation || '',
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
    };
}

export default function PatientFormModal({
    open,
    onClose,
    onSaved,
    initialPatient,
    lookups,
}) {
    const [form, setForm] = useState(makeEmptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const mode = useMemo(
        () => (initialPatient ? 'edit' : 'create'),
        [initialPatient]
    );

    useEffect(() => {
        if (open) {
            setError('');
            if (initialPatient) {
                setForm(mapPatientToForm(initialPatient));
            } else {
                setForm(makeEmptyForm());
            }
        }
    }, [open, initialPatient]);

    if (!open) return null;

    const handleChange = (field) => (e) => {
        const value = e.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleAddressChange = (field) => (e) => {
        const value = e.target.value;
        setForm((prev) => ({
            ...prev,
            address: { ...prev.address, [field]: value },
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const payload = {
                ...form,
                ref_doctor_id: form.ref_doctor_id || null,
                credit_payer_id: form.credit_payer_id || null,
                credit_tpa_id: form.credit_tpa_id || null,
                credit_plan_id: form.credit_plan_id || null,
                family_id: form.family_id || null,
            };
            let res;
            if (mode === 'create') {
                res = await createPatient(payload);
            } else {
                res = await updatePatient(initialPatient.id, payload);
            }
            onSaved && onSaved(res.data);
            onClose && onClose();
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save patient';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    const { refSources, doctors, payers, tpas, creditPlans } = lookups || {};

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-stretch justify-center">
            {/* Click on dark area to close */}
            <div
                className="absolute inset-0"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Modal container */}
            <div
                className="relative z-10 w-full max-w-6xl h-full sm:h-[95vh] mx-auto my-0 sm:my-4 bg-white rounded-none sm:rounded-3xl shadow-xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                                {mode === 'create' ? 'New Patient' : 'Edit Patient'}
                            </h2>
                            <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {mode === 'create' ? 'Create' : 'Update'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Fill basic details, address and credit / insurance information.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-lg leading-none"
                    >
                        ×
                    </button>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    className="flex-1 flex flex-col overflow-hidden"
                >
                    {/* Body (scrollable) */}
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 bg-slate-50/60">
                        {error && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                {error}
                            </div>
                        )}

                        {/* Basic Information */}
                        <section className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-slate-800">
                                    Basic Information
                                </h3>
                                {initialPatient?.uhid && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900/5 text-slate-700 border border-slate-200">
                                        UHID: {initialPatient.uhid}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        First Name<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                        value={form.first_name}
                                        onChange={handleChange('first_name')}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Last Name
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.last_name}
                                        onChange={handleChange('last_name')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Gender<span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.gender}
                                        onChange={handleChange('gender')}
                                        required
                                    >
                                        <option value="">Select</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Date of Birth
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.dob || ''}
                                        onChange={handleChange('dob')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Blood Group
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.blood_group}
                                        onChange={handleChange('blood_group')}
                                    >
                                        {BLOOD_GROUPS.map((bg) => (
                                            <option key={bg} value={bg}>
                                                {bg || 'Select'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Marital Status
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.marital_status}
                                        onChange={handleChange('marital_status')}
                                    >
                                        {MARITAL_STATUSES.map((st) => (
                                            <option key={st} value={st}>
                                                {st || 'Select'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Mobile
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.phone}
                                        onChange={handleChange('phone')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.email}
                                        onChange={handleChange('email')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Aadhaar Last 4
                                    </label>
                                    <input
                                        maxLength={4}
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.aadhar_last4}
                                        onChange={handleChange('aadhar_last4')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Patient Type
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.patient_type}
                                        onChange={handleChange('patient_type')}
                                    >
                                        {PATIENT_TYPES.map((t) => (
                                            <option key={t} value={t}>
                                                {t || 'Select'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Tag
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.tag}
                                        onChange={handleChange('tag')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Religion
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.religion}
                                        onChange={handleChange('religion')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Occupation
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.occupation}
                                        onChange={handleChange('occupation')}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Reference / Guardian */}
                        <section className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 space-y-3">
                            <h3 className="text-sm font-semibold text-slate-800">
                                Reference & Guardian
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Reference Source
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.ref_source}
                                        onChange={handleChange('ref_source')}
                                    >
                                        <option value="">Select</option>
                                        {refSources?.map((src) => (
                                            <option key={src.code} value={src.code}>
                                                {src.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Referring Doctor
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.ref_doctor_id || ''}
                                        onChange={handleChange('ref_doctor_id')}
                                    >
                                        <option value="">Select</option>
                                        {doctors?.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                                {d.department_name ? ` (${d.department_name})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="sm:col-span-2 lg:col-span-3">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Reference Details
                                    </label>
                                    <textarea
                                        rows={2}
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.ref_details}
                                        onChange={handleChange('ref_details')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Guardian Name
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.guardian_name}
                                        onChange={handleChange('guardian_name')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Guardian Phone
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.guardian_phone}
                                        onChange={handleChange('guardian_phone')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Guardian Relation
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.guardian_relation}
                                        onChange={handleChange('guardian_relation')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        ID Proof Type
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.id_proof_type}
                                        onChange={handleChange('id_proof_type')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        ID Proof No
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.id_proof_no}
                                        onChange={handleChange('id_proof_no')}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Address */}
                        <section className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 space-y-3">
                            <h3 className="text-sm font-semibold text-slate-800">Address</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Address Line 1
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.address.line1}
                                        onChange={handleAddressChange('line1')}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Address Line 2
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.address.line2}
                                        onChange={handleAddressChange('line2')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        City
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.address.city}
                                        onChange={handleAddressChange('city')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        State
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.address.state}
                                        onChange={handleAddressChange('state')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Pincode
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.address.pincode}
                                        onChange={handleAddressChange('pincode')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Country
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.address.country}
                                        onChange={handleAddressChange('country')}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* File & Credit / Insurance */}
                        <section className="bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 sm:py-4 space-y-3">
                            <h3 className="text-sm font-semibold text-slate-800">
                                File & Credit / Insurance
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        File Number
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.file_number}
                                        onChange={handleChange('file_number')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        File Location
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.file_location}
                                        onChange={handleChange('file_location')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Credit Type
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.credit_type}
                                        onChange={handleChange('credit_type')}
                                    >
                                        {CREDIT_TYPES.map((t) => (
                                            <option key={t} value={t}>
                                                {t || 'Select'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Payer
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.credit_payer_id || ''}
                                        onChange={handleChange('credit_payer_id')}
                                    >
                                        <option value="">Select</option>
                                        {payers?.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.display_name || p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        TPA
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.credit_tpa_id || ''}
                                        onChange={handleChange('credit_tpa_id')}
                                    >
                                        <option value="">Select</option>
                                        {tpas?.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.display_name || t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Credit Plan
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.credit_plan_id || ''}
                                        onChange={handleChange('credit_plan_id')}
                                    >
                                        <option value="">Select</option>
                                        {creditPlans?.map((cp) => (
                                            <option key={cp.id} value={cp.id}>
                                                {cp.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-2 lg:col-span-3">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Principal Member Name
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.principal_member_name}
                                        onChange={handleChange('principal_member_name')}
                                    />
                                </div>

                                <div className="sm:col-span-2 lg:col-span-3">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Principal Member Address
                                    </label>
                                    <textarea
                                        rows={2}
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.principal_member_address}
                                        onChange={handleChange('principal_member_address')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Policy Number
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.policy_number}
                                        onChange={handleChange('policy_number')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Policy Name
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.policy_name}
                                        onChange={handleChange('policy_name')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Family ID
                                    </label>
                                    <input
                                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"
                                        value={form.family_id}
                                        onChange={handleChange('family_id')}
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Footer buttons */}
                    <div className="border-t border-slate-200 px-4 sm:px-6 py-3 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500">
                            Fields marked with <span className="text-red-500">*</span> are mandatory.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                                disabled={saving}
                            >
                                {saving
                                    ? mode === 'create'
                                        ? 'Creating...'
                                        : 'Saving...'
                                    : mode === 'create'
                                        ? 'Create Patient'
                                        : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
