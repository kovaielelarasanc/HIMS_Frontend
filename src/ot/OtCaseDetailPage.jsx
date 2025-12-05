// FILE: frontend/src/ot/OtCaseDetailPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    getOtCase,
    getPreAnaesthesia,
    createPreAnaesthesia,
    updatePreAnaesthesia,
    getPreOpChecklist,
    createPreOpChecklist,
    updatePreOpChecklist,
    getSafetyChecklist,
    createSafetyChecklist,
    updateSafetyChecklist,
    getAnaesthesiaRecord,
    createAnaesthesiaRecord,
    updateAnaesthesiaRecord,
    listAnaesthesiaVitals,
    createAnaesthesiaVital,
    deleteAnaesthesiaVital,
    listAnaesthesiaDrugs,
    createAnaesthesiaDrug,
    deleteAnaesthesiaDrug,
    getOperationNote,
    createOperationNote,
    updateOperationNote,
    getPacuRecord,
    createPacuRecord,
    updatePacuRecord,
    listCleaningLogs,
    getIntraOpNursing,
    createIntraOpNursing,
    updateIntraOpNursing,
    getSpongeCount,
    createSpongeCount,
    updateSpongeCount,
    listImplants,
    createImplant,
    updateImplant,
    deleteImplant,
    listBloodTransfusions,
    createBloodTransfusion,
    updateBloodTransfusion,
    deleteBloodTransfusion,
} from '../api/ot'
import { useCan } from '../hooks/useCan'
import {
    ArrowLeft,
    AlertTriangle,
    Activity,
    ClipboardCheck,
    Stethoscope,
    Syringe,
    FileText,
    BedDouble,
    Clock3,
    User,
    ShieldCheck,
    Thermometer,
    HeartPulse,
    Plus,
    Trash2,
    ClipboardList,
    Pill,
    // NEW
    Droplets,
    Package,
} from 'lucide-react'

const TABS = [
    { id: 'preop', label: 'Pre-op Checklist' },
    { id: 'safety', label: 'WHO Safety' },
    { id: 'anaesthesia', label: 'Anaesthesia' },
    { id: 'nursing', label: 'Intra-op Nursing' },
    { id: 'counts', label: 'Instrument & Sponge Counts' },
    { id: 'implants', label: 'Implants & Devices' },
    { id: 'blood', label: 'Blood & Transfusions' },
    { id: 'notes', label: 'Operation Notes' },
    { id: 'pacu', label: 'PACU / Recovery' },
    { id: 'logs', label: 'OT Logs' },
]


// simple helper
const toTimeInput = (t) => (t ? String(t).slice(0, 5) : '')

// =======================
//   PRE-OP CHECKLIST TAB
// =======================

function PreopTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.preop.view')
    const canEdit = useCan('ot.preop.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [form, setForm] = useState({
        patient_identity_confirmed: false,
        consent_checked: false,
        site_marked: false,
        investigations_checked: false,
        implants_available: false,
        blood_products_arranged: false,
        fasting_status: '',
        device_checks: '',
        notes: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getPreOpChecklist(caseId)
            if (res.data) {
                setData(res.data)
                setForm({
                    patient_identity_confirmed: !!res.data.patient_identity_confirmed,
                    consent_checked: !!res.data.consent_checked,
                    site_marked: !!res.data.site_marked,
                    investigations_checked: !!res.data.investigations_checked,
                    implants_available: !!res.data.implants_available,
                    blood_products_arranged: !!res.data.blood_products_arranged,
                    fasting_status: res.data.fasting_status || '',
                    device_checks: res.data.device_checks || '',
                    notes: res.data.notes || '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)
            } else {
                console.error('Failed to load Pre-op checklist', err)
                setError('Failed to load Pre-op checklist')
            }
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

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return

        setSaving(true)
        setError(null)
        try {
            const payload = {
                patient_identity_confirmed: !!form.patient_identity_confirmed,
                consent_checked: !!form.consent_checked,
                site_marked: !!form.site_marked,
                investigations_checked: !!form.investigations_checked,
                implants_available: !!form.implants_available,
                blood_products_arranged: !!form.blood_products_arranged,
                fasting_status: form.fasting_status || null,
                device_checks: form.device_checks || null,
                notes: form.notes || null,
            }

            if (data) {
                await updatePreOpChecklist(caseId, payload)
            } else {
                await createPreOpChecklist(caseId, payload)
            }
            await load()
        } catch (err) {
            console.error('Failed to save Pre-op checklist', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save Pre-op checklist'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border bg-white px-4 py-3"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <ClipboardCheck className="h-4 w-4" />
                    <span className="text-sm font-semibold">Pre-operative checklist</span>
                </div>
                {data && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {data?.updated_at || data?.created_at || '—'}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">Loading pre-op data...</div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                    ['patient_identity_confirmed', 'Patient identity confirmed'],
                    ['consent_checked', 'Consent checked & available'],
                    ['site_marked', 'Operative site marked'],
                    ['investigations_checked', 'Investigations reviewed'],
                    ['implants_available', 'Implants / devices available'],
                    ['blood_products_arranged', 'Blood products arranged'],
                ].map(([field, label]) => (
                    <label
                        key={field}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 hover:border-sky-400"
                    >
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={!!form[field]}
                            disabled={!canEdit}
                            onChange={(e) => handleChange(field, e.target.checked)}
                        />
                        <span>{label}</span>
                    </label>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Fasting status
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="E.g., last solids 10 pm, last liquids 12 am"
                        value={form.fasting_status}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('fasting_status', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Device / machine checks
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Monitors, suction, O2, OT table, cautery..."
                        value={form.device_checks}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('device_checks', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Notes</label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={form.notes}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('notes', e.target.value)}
                />
            </div>

            {canEdit && (
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                        )}
                        Save Pre-op checklist
                    </button>
                </div>
            )}
        </form>
    )
}

// ===========================
//   SURGICAL SAFETY TAB
// ===========================

function SafetyTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.safety.view')
    const canEdit = useCan('ot.safety.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [form, setForm] = useState({
        sign_in_done: false,
        sign_in_time: '',
        time_out_done: false,
        time_out_time: '',
        sign_out_done: false,
        sign_out_time: '',
        critical_events_discussed: '',
        antibiotics_given: false,
        instruments_count_correct: false,
        implants_label_verified: false,
        notes: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getSafetyChecklist(caseId)
            if (res.data) {
                const s = res.data
                setData(s)
                setForm({
                    sign_in_done: !!s.sign_in_done,
                    sign_in_time: toTimeInput(s.sign_in_time),
                    time_out_done: !!s.time_out_done,
                    time_out_time: toTimeInput(s.time_out_time),
                    sign_out_done: !!s.sign_out_done,
                    sign_out_time: toTimeInput(s.sign_out_time),
                    critical_events_discussed: s.critical_events_discussed || '',
                    antibiotics_given: !!s.antibiotics_given,
                    instruments_count_correct: !!s.instruments_count_correct,
                    implants_label_verified: !!s.implants_label_verified,
                    notes: s.notes || '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)
            } else {
                console.error('Failed to load Surgical Safety checklist', err)
                setError('Failed to load Surgical Safety checklist')
            }
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
                You do not have permission to view Surgical Safety Checklist.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return

        setSaving(true)
        setError(null)
        try {
            const payload = {
                sign_in_done: !!form.sign_in_done,
                sign_in_time: form.sign_in_time || null,
                time_out_done: !!form.time_out_done,
                time_out_time: form.time_out_time || null,
                sign_out_done: !!form.sign_out_done,
                sign_out_time: form.sign_out_time || null,
                critical_events_discussed: form.critical_events_discussed || null,
                antibiotics_given: !!form.antibiotics_given,
                instruments_count_correct: !!form.instruments_count_correct,
                implants_label_verified: !!form.implants_label_verified,
                notes: form.notes || null,
            }

            if (data) {
                await updateSafetyChecklist(caseId, payload)
            } else {
                await createSafetyChecklist(caseId, payload)
            }
            await load()
        } catch (err) {
            console.error('Failed to save Surgical Safety checklist', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save Surgical Safety checklist'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border bg-white px-4 py-3"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-sm font-semibold">WHO Surgical Safety Checklist</span>
                </div>
                {data && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {data?.updated_at || data?.created_at || '—'}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">
                    Loading Surgical Safety data...
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {/* Sign-in */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Sign in (before induction)
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={!!form.sign_in_done}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('sign_in_done', e.target.checked)}
                        />
                        <span>Completed</span>
                    </div>
                    <div className="mt-1 space-y-1">
                        <label className="text-[11px] text-slate-600">Time</label>
                        <input
                            type="time"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.sign_in_time}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('sign_in_time', e.target.value)}
                        />
                    </div>
                </div>

                {/* Time-out */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Time out (before incision)
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={!!form.time_out_done}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('time_out_done', e.target.checked)}
                        />
                        <span>Completed</span>
                    </div>
                    <div className="mt-1 space-y-1">
                        <label className="text-[11px] text-slate-600">Time</label>
                        <input
                            type="time"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.time_out_time}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('time_out_time', e.target.value)}
                        />
                    </div>
                </div>

                {/* Sign-out */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Sign out (before leaving OT)
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={!!form.sign_out_done}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('sign_out_done', e.target.checked)}
                        />
                        <span>Completed</span>
                    </div>
                    <div className="mt-1 space-y-1">
                        <label className="text-[11px] text-slate-600">Time</label>
                        <input
                            type="time"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.sign_out_time}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('sign_out_time', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 hover:border-sky-400">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={!!form.antibiotics_given}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('antibiotics_given', e.target.checked)
                        }
                    />
                    <span>Prophylactic antibiotics given within 60 min</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 hover:border-sky-400">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={!!form.instruments_count_correct}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('instruments_count_correct', e.target.checked)
                        }
                    />
                    <span>Sponge / instrument / needle count correct</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 hover:border-sky-400">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={!!form.implants_label_verified}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('implants_label_verified', e.target.checked)
                        }
                    />
                    <span>Implant details & labels verified</span>
                </label>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                    Critical events / concerns discussed
                </label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={form.critical_events_discussed}
                    disabled={!canEdit}
                    onChange={(e) =>
                        handleChange('critical_events_discussed', e.target.value)
                    }
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Notes</label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={form.notes}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('notes', e.target.value)}
                />
            </div>

            {canEdit && (
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                        )}
                        Save Safety checklist
                    </button>
                </div>
            )}
        </form>
    )
}

// ===========================
//   ANAESTHESIA TAB
// ===========================

function AnaesthesiaTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.anaesthesia.view')
    const canEdit = useCan('ot.anaesthesia.manage') || useCan('ot.case.update')

    const [record, setRecord] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [form, setForm] = useState({
        anaesthesia_type: '',
        asa_grade: '',
        airway_assessment: '',
        comorbidities: '',
        allergies: '',
        notes: '',
    })

    // vitals & drug logs
    const [vitals, setVitals] = useState([])
    const [drugs, setDrugs] = useState([])
    const [loadingVitals, setLoadingVitals] = useState(false)
    const [loadingDrugs, setLoadingDrugs] = useState(false)
    const [vitalForm, setVitalForm] = useState({
        time: '',
        hr: '',
        bp: '',
        spo2: '',
        rr: '',
        temp_c: '',
    })
    const [drugForm, setDrugForm] = useState({
        time: '',
        drug_name: '',
        dose: '',
        route: '',
        remarks: '',
    })

    const loadRecord = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getAnaesthesiaRecord(caseId)
            if (res.data) {
                const r = res.data
                setRecord(r)
                setForm({
                    anaesthesia_type: r.anaesthesia_type || '',
                    asa_grade: r.asa_grade || '',
                    airway_assessment: r.airway_assessment || '',
                    comorbidities: r.comorbidities || '',
                    allergies: r.allergies || '',
                    notes: r.notes || '',
                })
                // load vitals + drugs
                loadVitals(r.id)
                loadDrugs(r.id)
            } else {
                setRecord(null)
                setVitals([])
                setDrugs([])
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setRecord(null)
                setVitals([])
                setDrugs([])
            } else {
                console.error('Failed to load Anaesthesia record', err)
                setError('Failed to load Anaesthesia record')
            }
        } finally {
            setLoading(false)
        }
    }

    const loadVitals = async (recordId) => {
        if (!recordId) return
        try {
            setLoadingVitals(true)
            const res = await listAnaesthesiaVitals(recordId)
            setVitals(res.data || [])
        } catch (err) {
            console.error('Failed to load anaesthesia vitals', err)
        } finally {
            setLoadingVitals(false)
        }
    }

    const loadDrugs = async (recordId) => {
        if (!recordId) return
        try {
            setLoadingDrugs(true)
            const res = await listAnaesthesiaDrugs(recordId)
            setDrugs(res.data || [])
        } catch (err) {
            console.error('Failed to load anaesthesia drugs', err)
        } finally {
            setLoadingDrugs(false)
        }
    }

    useEffect(() => {
        loadRecord()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, canView])

    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You do not have permission to view Anaesthesia records.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmitRecord = async (e) => {
        e.preventDefault()
        if (!canEdit) return

        setSaving(true)
        setError(null)
        try {
            const payload = {
                anaesthesia_type: form.anaesthesia_type || null,
                asa_grade: form.asa_grade || null,
                airway_assessment: form.airway_assessment || null,
                comorbidities: form.comorbidities || null,
                allergies: form.allergies || null,
                notes: form.notes || null,
            }
            if (record) {
                await updateAnaesthesiaRecord(caseId, payload)
            } else {
                await createAnaesthesiaRecord(caseId, payload)
            }
            await loadRecord()
        } catch (err) {
            console.error('Failed to save Anaesthesia record', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save Anaesthesia record'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    const handleAddVital = async (e) => {
        e.preventDefault()
        if (!canEdit || !record?.id) return
        try {
            const payload = {
                time: vitalForm.time || null,
                hr: vitalForm.hr || null,
                bp: vitalForm.bp || null,
                spo2: vitalForm.spo2 || null,
                rr: vitalForm.rr || null,
                temp_c: vitalForm.temp_c || null,
            }
            await createAnaesthesiaVital(record.id, payload)
            setVitalForm({
                time: '',
                hr: '',
                bp: '',
                spo2: '',
                rr: '',
                temp_c: '',
            })
            await loadVitals(record.id)
        } catch (err) {
            console.error('Failed to add vital', err)
            alert('Failed to add vital')
        }
    }

    const handleDeleteVital = async (id) => {
        if (!canEdit) return
        if (!window.confirm('Delete this vital entry?')) return
        try {
            await deleteAnaesthesiaVital(id)
            if (record?.id) loadVitals(record.id)
        } catch (err) {
            console.error('Failed to delete vital', err)
            alert('Failed to delete vital')
        }
    }

    const handleAddDrug = async (e) => {
        e.preventDefault()
        if (!canEdit || !record?.id) return
        try {
            const payload = {
                time: drugForm.time || null,
                drug_name: drugForm.drug_name || null,
                dose: drugForm.dose || null,
                route: drugForm.route || null,
                remarks: drugForm.remarks || null,
            }
            await createAnaesthesiaDrug(record.id, payload)
            setDrugForm({
                time: '',
                drug_name: '',
                dose: '',
                route: '',
                remarks: '',
            })
            await loadDrugs(record.id)
        } catch (err) {
            console.error('Failed to add drug entry', err)
            alert('Failed to add drug entry')
        }
    }

    const handleDeleteDrug = async (id) => {
        if (!canEdit) return
        if (!window.confirm('Delete this drug entry?')) return
        try {
            await deleteAnaesthesiaDrug(id)
            if (record?.id) loadDrugs(record.id)
        } catch (err) {
            console.error('Failed to delete drug entry', err)
            alert('Failed to delete drug entry')
        }
    }

    return (
        <div className="space-y-3">
            <form
                onSubmit={handleSubmitRecord}
                className="space-y-3 rounded-2xl border bg-white px-4 py-3"
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sky-800">
                        <Syringe className="h-4 w-4" />
                        <span className="text-sm font-semibold">Anaesthesia record</span>
                    </div>
                    {record && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                            Last updated: {record?.updated_at || record?.created_at || '—'}
                        </span>
                    )}
                </div>

                {loading && (
                    <div className="text-xs text-slate-500">
                        Loading Anaesthesia record...
                    </div>
                )}

                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                            Type of anaesthesia
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.anaesthesia_type}
                            disabled={!canEdit}
                            onChange={(e) =>
                                handleChange('anaesthesia_type', e.target.value)
                            }
                            placeholder="GA, SA, CSE, MAC etc."
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                            ASA grade
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.asa_grade}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('asa_grade', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                            Airway assessment
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.airway_assessment}
                            disabled={!canEdit}
                            onChange={(e) =>
                                handleChange('airway_assessment', e.target.value)
                            }
                            placeholder="Mallampati, mouth opening, neck..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                            Comorbidities
                        </label>
                        <textarea
                            rows={2}
                            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.comorbidities}
                            disabled={!canEdit}
                            onChange={(e) =>
                                handleChange('comorbidities', e.target.value)
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                            Allergies
                        </label>
                        <textarea
                            rows={2}
                            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.allergies}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('allergies', e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Notes</label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.notes}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('notes', e.target.value)}
                    />
                </div>

                {canEdit && (
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                            )}
                            Save Anaesthesia record
                        </button>
                    </div>
                )}
            </form>

            {/* VITALS LOG */}
            {record && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border bg-white px-4 py-3 text-xs">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-slate-800">
                                <HeartPulse className="h-4 w-4" />
                                <span className="text-sm font-semibold">
                                    Intra-op vitals log
                                </span>
                            </div>
                        </div>

                        <div className="max-h-56 overflow-auto rounded-xl border bg-slate-50">
                            <table className="min-w-full text-left text-[11px] text-slate-700">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-3 py-1.5">Time</th>
                                        <th className="px-3 py-1.5">HR</th>
                                        <th className="px-3 py-1.5">BP</th>
                                        <th className="px-3 py-1.5">SpO₂</th>
                                        <th className="px-3 py-1.5">RR</th>
                                        <th className="px-3 py-1.5">Temp</th>
                                        <th className="px-3 py-1.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingVitals && (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-3 py-2 text-center text-[11px] text-slate-500"
                                            >
                                                Loading vitals...
                                            </td>
                                        </tr>
                                    )}
                                    {!loadingVitals && vitals.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-3 py-2 text-center text-[11px] text-slate-500"
                                            >
                                                No vitals logged.
                                            </td>
                                        </tr>
                                    )}
                                    {!loadingVitals &&
                                        vitals.map((v) => (
                                            <tr key={v.id} className="border-t border-slate-100">
                                                <td className="px-3 py-1.5">{v.time || '—'}</td>
                                                <td className="px-3 py-1.5">{v.hr || '—'}</td>
                                                <td className="px-3 py-1.5">{v.bp || '—'}</td>
                                                <td className="px-3 py-1.5">{v.spo2 || '—'}</td>
                                                <td className="px-3 py-1.5">{v.rr || '—'}</td>
                                                <td className="px-3 py-1.5">
                                                    {v.temp_c != null ? `${v.temp_c}°C` : '—'}
                                                </td>
                                                <td className="px-3 py-1.5 text-right">
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteVital(v.id)}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                            Delete
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>

                        {canEdit && (
                            <form
                                onSubmit={handleAddVital}
                                className="mt-2 grid grid-cols-6 gap-1.5"
                            >
                                {['time', 'hr', 'bp', 'spo2', 'rr', 'temp_c'].map((field) => (
                                    <input
                                        key={field}
                                        type={field === 'time' ? 'time' : 'text'}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        placeholder={
                                            {
                                                time: 'Time',
                                                hr: 'HR',
                                                bp: 'BP',
                                                spo2: 'SpO₂',
                                                rr: 'RR',
                                                temp_c: 'Temp',
                                            }[field]
                                        }
                                        value={vitalForm[field]}
                                        onChange={(e) =>
                                            setVitalForm((f) => ({
                                                ...f,
                                                [field]: e.target.value,
                                            }))
                                        }
                                    />
                                ))}
                                <div className="col-span-6 flex justify-end pt-1">
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-1 rounded-lg border border-sky-600 bg-sky-600 px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-sky-700"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add vital
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* DRUG LOG */}
                    <div className="rounded-2xl border bg-white px-4 py-3 text-xs">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-slate-800">
                                <Activity className="h-4 w-4" />
                                <span className="text-sm font-semibold">
                                    Anaesthesia drug log
                                </span>
                            </div>
                        </div>

                        <div className="max-h-56 overflow-auto rounded-xl border bg-slate-50">
                            <table className="min-w-full text-left text-[11px] text-slate-700">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-3 py-1.5">Time</th>
                                        <th className="px-3 py-1.5">Drug</th>
                                        <th className="px-3 py-1.5">Dose</th>
                                        <th className="px-3 py-1.5">Route</th>
                                        <th className="px-3 py-1.5">Remarks</th>
                                        <th className="px-3 py-1.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingDrugs && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-3 py-2 text-center text-[11px] text-slate-500"
                                            >
                                                Loading drug entries...
                                            </td>
                                        </tr>
                                    )}
                                    {!loadingDrugs && drugs.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-3 py-2 text-center text-[11px] text-slate-500"
                                            >
                                                No drug entries logged.
                                            </td>
                                        </tr>
                                    )}
                                    {!loadingDrugs &&
                                        drugs.map((d) => (
                                            <tr key={d.id} className="border-t border-slate-100">
                                                <td className="px-3 py-1.5">{d.time || '—'}</td>
                                                <td className="px-3 py-1.5">{d.drug_name || '—'}</td>
                                                <td className="px-3 py-1.5">{d.dose || '—'}</td>
                                                <td className="px-3 py-1.5">{d.route || '—'}</td>
                                                <td className="px-3 py-1.5">
                                                    {d.remarks || '—'}
                                                </td>
                                                <td className="px-3 py-1.5 text-right">
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteDrug(d.id)}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                            Delete
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>

                        {canEdit && (
                            <form
                                onSubmit={handleAddDrug}
                                className="mt-2 grid grid-cols-5 gap-1.5"
                            >
                                {['time', 'drug_name', 'dose', 'route', 'remarks'].map(
                                    (field) => (
                                        <input
                                            key={field}
                                            type={field === 'time' ? 'time' : 'text'}
                                            className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                            placeholder={
                                                {
                                                    time: 'Time',
                                                    drug_name: 'Drug',
                                                    dose: 'Dose',
                                                    route: 'Route',
                                                    remarks: 'Remarks',
                                                }[field]
                                            }
                                            value={drugForm[field]}
                                            onChange={(e) =>
                                                setDrugForm((f) => ({
                                                    ...f,
                                                    [field]: e.target.value,
                                                }))
                                            }
                                        />
                                    ),
                                )}
                                <div className="col-span-5 flex justify-end pt-1">
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-1 rounded-lg border border-sky-600 bg-sky-600 px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-sky-700"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add drug
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// ===========================
//   OPERATION NOTES TAB
// ===========================

function OperationNotesTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.notes.view')
    const canEdit = useCan('ot.notes.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [form, setForm] = useState({
        diagnosis_pre: '',
        diagnosis_post: '',
        procedure_performed: '',
        findings: '',
        steps: '',
        complications: '',
        drains: '',
        blood_loss_ml: '',
        samples_sent: '',
        post_op_orders: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getOperationNote(caseId)
            if (res.data) {
                const n = res.data
                setData(n)
                setForm({
                    diagnosis_pre: n.diagnosis_pre || '',
                    diagnosis_post: n.diagnosis_post || '',
                    procedure_performed: n.procedure_performed || '',
                    findings: n.findings || '',
                    steps: n.steps || '',
                    complications: n.complications || '',
                    drains: n.drains || '',
                    blood_loss_ml: n.blood_loss_ml ?? '',
                    samples_sent: n.samples_sent || '',
                    post_op_orders: n.post_op_orders || '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)
            } else {
                console.error('Failed to load Operation note', err)
                setError('Failed to load Operation note')
            }
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
                You do not have permission to view Operation notes.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return

        setSaving(true)
        setError(null)
        try {
            const payload = {
                diagnosis_pre: form.diagnosis_pre || null,
                diagnosis_post: form.diagnosis_post || null,
                procedure_performed: form.procedure_performed || null,
                findings: form.findings || null,
                steps: form.steps || null,
                complications: form.complications || null,
                drains: form.drains || null,
                blood_loss_ml:
                    form.blood_loss_ml === '' ? null : Number(form.blood_loss_ml),
                samples_sent: form.samples_sent || null,
                post_op_orders: form.post_op_orders || null,
            }
            if (data) {
                await updateOperationNote(caseId, payload)
            } else {
                await createOperationNote(caseId, payload)
            }
            await load()
        } catch (err) {
            console.error('Failed to save Operation note', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save Operation note'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border bg-white px-4 py-3"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-semibold">Operation notes</span>
                </div>
                {data && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {data?.updated_at || data?.created_at || '—'}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">Loading Operation notes...</div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Pre-op diagnosis
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.diagnosis_pre}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('diagnosis_pre', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Post-op diagnosis
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.diagnosis_post}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('diagnosis_post', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                    Procedure performed
                </label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={form.procedure_performed}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('procedure_performed', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Findings</label>
                    <textarea
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.findings}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('findings', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Steps / technique
                    </label>
                    <textarea
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.steps}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('steps', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Complications
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.complications}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('complications', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Drains / tubes
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.drains}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('drains', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Approx. blood loss (ml)
                    </label>
                    <input
                        type="number"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.blood_loss_ml}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('blood_loss_ml', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Samples sent (histopath, culture etc.)
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.samples_sent}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('samples_sent', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Immediate post-op orders
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.post_op_orders}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('post_op_orders', e.target.value)}
                    />
                </div>
            </div>

            {canEdit && (
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                        )}
                        Save Operation note
                    </button>
                </div>
            )}
        </form>
    )
}

// ===========================
//   PACU TAB
// ===========================

function PacuTab({ caseId }) {
    const canView = useCan('ot.cases.view') || useCan('ot.pacu.view')

    const canEdit = useCan('ot.pacu.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [form, setForm] = useState({
        arrival_time: '',
        departure_time: '',
        pain_score: '',
        nausea_vomiting: '',
        airway_status: '',
        vitals_summary: '',
        complications: '',
        discharge_criteria_met: false,
        notes: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getPacuRecord(caseId)
            if (res.data) {
                const r = res.data
                setData(r)
                setForm({
                    arrival_time: toTimeInput(r.arrival_time),
                    departure_time: toTimeInput(r.departure_time),
                    pain_score: r.pain_score || '',
                    nausea_vomiting: r.nausea_vomiting || '',
                    airway_status: r.airway_status || '',
                    vitals_summary: r.vitals_summary || '',
                    complications: r.complications || '',
                    discharge_criteria_met: !!r.discharge_criteria_met,
                    notes: r.notes || '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)
            } else {
                console.error('Failed to load PACU record', err)
                setError('Failed to load PACU record')
            }
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
                You do not have permission to view PACU records.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return

        setSaving(true)
        setError(null)
        try {
            const payload = {
                arrival_time: form.arrival_time || null,
                departure_time: form.departure_time || null,
                pain_score: form.pain_score || null,
                nausea_vomiting: form.nausea_vomiting || null,
                airway_status: form.airway_status || null,
                vitals_summary: form.vitals_summary || null,
                complications: form.complications || null,
                discharge_criteria_met: !!form.discharge_criteria_met,
                notes: form.notes || null,
            }
            if (data) {
                await updatePacuRecord(caseId, payload)
            } else {
                await createPacuRecord(caseId, payload)
            }
            await load()
        } catch (err) {
            console.error('Failed to save PACU record', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save PACU record'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border bg-white px-4 py-3"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <BedDouble className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                        PACU / Post-anaesthesia recovery
                    </span>
                </div>
                {data && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {data?.updated_at || data?.created_at || '—'}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">Loading PACU record...</div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Arrival time
                    </label>
                    <input
                        type="time"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.arrival_time}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('arrival_time', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Departure time
                    </label>
                    <input
                        type="time"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.departure_time}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('departure_time', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Pain score
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="e.g., 3/10"
                        value={form.pain_score}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('pain_score', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Nausea / vomiting
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.nausea_vomiting}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('nausea_vomiting', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Airway status
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.airway_status}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('airway_status', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Vitals summary
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.vitals_summary}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('vitals_summary', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                    PACU complications
                </label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={form.complications}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('complications', e.target.value)}
                />
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 hover:border-sky-400">
                <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={!!form.discharge_criteria_met}
                    disabled={!canEdit}
                    onChange={(e) =>
                        handleChange('discharge_criteria_met', e.target.checked)
                    }
                />
                <span>PACU discharge criteria met; patient shifted as per orders</span>
            </label>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Notes</label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={form.notes}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('notes', e.target.value)}
                />
            </div>

            {canEdit && (
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                        )}
                        Save PACU record
                    </button>
                </div>
            )}
        </form>
    )
}



// ===========================
//   INTRA-OP NURSING TAB
// ===========================

function NursingTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.nursing.view')
    const canEdit = useCan('ot.nursing.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [form, setForm] = useState({
        scrub_nurse_name: '',
        circulating_nurse_name: '',
        positioning: '',
        skin_prep: '',
        catheterisation: '',
        diathermy_plate_site: '',
        counts_initial_done: false,
        counts_closure_done: false,
        antibiotics_time: '',
        warming_measures: '',
        notes: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getIntraOpNursing(caseId)
            if (res.data) {
                const r = res.data
                setData(r)
                setForm({
                    scrub_nurse_name: r.scrub_nurse_name || '',
                    circulating_nurse_name: r.circulating_nurse_name || '',
                    positioning: r.positioning || '',
                    skin_prep: r.skin_prep || '',
                    catheterisation: r.catheterisation || '',
                    diathermy_plate_site: r.diathermy_plate_site || '',
                    counts_initial_done: !!r.counts_initial_done,
                    counts_closure_done: !!r.counts_closure_done,
                    antibiotics_time: toTimeInput(r.antibiotics_time),
                    warming_measures: r.warming_measures || '',
                    notes: r.notes || '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)
            } else {
                console.error('Failed to load intra-op nursing record', err)
                setError('Failed to load intra-op nursing record')
            }
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
                You do not have permission to view intra-op nursing records.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return
        setSaving(true)
        setError(null)
        try {
            const payload = {
                scrub_nurse_name: form.scrub_nurse_name || null,
                circulating_nurse_name: form.circulating_nurse_name || null,
                positioning: form.positioning || null,
                skin_prep: form.skin_prep || null,
                catheterisation: form.catheterisation || null,
                diathermy_plate_site: form.diathermy_plate_site || null,
                counts_initial_done: !!form.counts_initial_done,
                counts_closure_done: !!form.counts_closure_done,
                antibiotics_time: form.antibiotics_time || null,
                warming_measures: form.warming_measures || null,
                notes: form.notes || null,
            }
            if (data) {
                await updateIntraOpNursing(caseId, payload)
            } else {
                await createIntraOpNursing(caseId, payload)
            }
            await load()
        } catch (err) {
            console.error('Failed to save intra-op nursing record', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save intra-op nursing record'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border bg-white px-4 py-3"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <ClipboardList className="h-4 w-4" />
                    <span className="text-sm font-semibold">Intra-op nursing record</span>
                </div>
                {data && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {data?.updated_at || data?.created_at || '—'}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">
                    Loading intra-op nursing record...
                </div>
            )}
            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Scrub nurse
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.scrub_nurse_name}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('scrub_nurse_name', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Circulating nurse
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.circulating_nurse_name}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('circulating_nurse_name', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Patient positioning
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.positioning}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('positioning', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Skin preparation
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.skin_prep}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('skin_prep', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Catheterisation
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.catheterisation}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('catheterisation', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Diathermy plate site
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.diathermy_plate_site}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('diathermy_plate_site', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Prophylactic antibiotics time
                    </label>
                    <input
                        type="time"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.antibiotics_time}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('antibiotics_time', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Warming measures
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.warming_measures}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('warming_measures', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={!!form.counts_initial_done}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('counts_initial_done', e.target.checked)
                        }
                    />
                    <span>Initial sponge / instrument counts completed</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={!!form.counts_closure_done}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('counts_closure_done', e.target.checked)
                        }
                    />
                    <span>Final counts completed at closure</span>
                </label>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Notes</label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    value={form.notes}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('notes', e.target.value)}
                />
            </div>

            {canEdit && (
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                        )}
                        Save intra-op nursing record
                    </button>
                </div>
            )}
        </form>
    )
}


// ===========================
//   SPONGE / INSTRUMENT COUNT TAB
// ===========================

function CountsTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.counts.view')
    const canEdit = useCan('ot.counts.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [form, setForm] = useState({
        sponges_initial: '',
        sponges_added: '',
        sponges_final: '',
        instruments_initial: '',
        instruments_final: '',
        needles_initial: '',
        needles_final: '',
        discrepancy: '',
        xray_done: false,
        resolved_by: '',
        notes: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getSpongeCount(caseId)
            if (res.data) {
                const c = res.data
                setData(c)
                setForm({
                    sponges_initial: c.sponges_initial ?? '',
                    sponges_added: c.sponges_added ?? '',
                    sponges_final: c.sponges_final ?? '',
                    instruments_initial: c.instruments_initial ?? '',
                    instruments_final: c.instruments_final ?? '',
                    needles_initial: c.needles_initial ?? '',
                    needles_final: c.needles_final ?? '',
                    discrepancy: c.discrepancy || '',
                    xray_done: !!c.xray_done,
                    resolved_by: c.resolved_by || '',
                    notes: c.notes || '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)
            } else {
                console.error('Failed to load counts record', err)
                setError('Failed to load counts record')
            }
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
                You do not have permission to view sponge / instrument counts.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return
        setSaving(true)
        setError(null)
        try {
            const payload = {
                sponges_initial:
                    form.sponges_initial === '' ? null : Number(form.sponges_initial),
                sponges_added:
                    form.sponges_added === '' ? null : Number(form.sponges_added),
                sponges_final:
                    form.sponges_final === '' ? null : Number(form.sponges_final),
                instruments_initial:
                    form.instruments_initial === ''
                        ? null
                        : Number(form.instruments_initial),
                instruments_final:
                    form.instruments_final === ''
                        ? null
                        : Number(form.instruments_final),
                needles_initial:
                    form.needles_initial === '' ? null : Number(form.needles_initial),
                needles_final:
                    form.needles_final === '' ? null : Number(form.needles_final),
                discrepancy: form.discrepancy || null,
                xray_done: !!form.xray_done,
                resolved_by: form.resolved_by || null,
                notes: form.notes || null,
            }
            if (data) {
                await updateSpongeCount(caseId, payload)
            } else {
                await createSpongeCount(caseId, payload)
            }
            await load()
        } catch (err) {
            console.error('Failed to save counts record', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save counts record'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    const numberInput = (field, label) => (
        <div className="space-y-1" key={field}>
            <label className="text-xs font-medium text-slate-700">{label}</label>
            <input
                type="number"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                value={form[field]}
                disabled={!canEdit}
                onChange={(e) => handleChange(field, e.target.value)}
            />
        </div>
    )

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border bg-white px-4 py-3"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                        Sponge / instrument / needle count
                    </span>
                </div>
                {data && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {data?.updated_at || data?.created_at || '—'}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">Loading counts record...</div>
            )}
            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {numberInput('sponges_initial', 'Sponges - initial')}
                {numberInput('sponges_added', 'Sponges - added during case')}
                {numberInput('sponges_final', 'Sponges - final count')}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {numberInput('instruments_initial', 'Instruments - initial')}
                {numberInput('instruments_final', 'Instruments - final')}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {numberInput('needles_initial', 'Needles - initial')}
                {numberInput('needles_final', 'Needles - final')}
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                    Discrepancy (if any)
                </label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    value={form.discrepancy}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('discrepancy', e.target.value)}
                />
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={!!form.xray_done}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('xray_done', e.target.checked)}
                />
                <span>Intra-op / post-op X-ray done for suspected retained item</span>
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Discrepancy resolved by
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.resolved_by}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('resolved_by', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Notes / corrective action
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.notes}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('notes', e.target.value)}
                    />
                </div>
            </div>

            {canEdit && (
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                        )}
                        Save counts record
                    </button>
                </div>
            )}
        </form>
    )
}



// ===========================
//   IMPLANTS / PROSTHESIS TAB
// ===========================

function ImplantsTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.implants.view')
    const canEdit = useCan('ot.implants.manage') || useCan('ot.case.update')

    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        name: '',
        lot_no: '',
        serial_no: '',
        manufacturer: '',
        expiry_date: '',
        quantity: '1',
        site: '',
        remarks: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await listImplants(caseId)
            setItems(res.data || [])
        } catch (err) {
            console.error('Failed to load implants', err)
            setError('Failed to load implant records')
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
                You do not have permission to view implant records.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return
        setSaving(true)
        try {
            const payload = {
                name: form.name || null,
                lot_no: form.lot_no || null,
                serial_no: form.serial_no || null,
                manufacturer: form.manufacturer || null,
                expiry_date: form.expiry_date || null,
                quantity:
                    form.quantity === '' ? null : Number(form.quantity || 1),
                site: form.site || null,
                remarks: form.remarks || null,
            }
            await createImplant(caseId, payload)
            setForm({
                name: '',
                lot_no: '',
                serial_no: '',
                manufacturer: '',
                expiry_date: '',
                quantity: '1',
                site: '',
                remarks: '',
            })
            await load()
        } catch (err) {
            console.error('Failed to add implant', err)
            alert(
                err?.response?.data?.detail || 'Failed to add implant entry',
            )
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!canEdit) return
        if (!window.confirm('Delete this implant record?')) return
        try {
            await deleteImplant(id)
            await load()
        } catch (err) {
            console.error('Failed to delete implant', err)
            alert('Failed to delete implant entry')
        }
    }

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border bg-white px-4 py-3 text-xs">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Package className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                            Implants / prosthesis used
                        </span>
                    </div>
                </div>

                {loading && (
                    <div className="text-xs text-slate-500">
                        Loading implant records...
                    </div>
                )}
                {error && (
                    <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                <div className="max-h-64 overflow-auto rounded-xl border bg-slate-50">
                    <table className="min-w-full text-left text-[11px] text-slate-700">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-3 py-1.5">Name</th>
                                <th className="px-3 py-1.5">Lot / Serial</th>
                                <th className="px-3 py-1.5">Manufacturer</th>
                                <th className="px-3 py-1.5">Expiry</th>
                                <th className="px-3 py-1.5">Qty</th>
                                <th className="px-3 py-1.5">Site</th>
                                <th className="px-3 py-1.5">Remarks</th>
                                <th className="px-3 py-1.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && items.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-3 py-2 text-center text-[11px] text-slate-500"
                                    >
                                        No implants added for this case.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                items.map((it) => (
                                    <tr key={it.id} className="border-t border-slate-100">
                                        <td className="px-3 py-1.5">{it.name || '—'}</td>
                                        <td className="px-3 py-1.5">
                                            {it.lot_no || '—'}
                                            {it.serial_no ? ` / ${it.serial_no}` : ''}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.manufacturer || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.expiry_date || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.quantity ?? '—'}
                                        </td>
                                        <td className="px-3 py-1.5">{it.site || '—'}</td>
                                        <td className="px-3 py-1.5">
                                            {it.remarks || '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(it.id)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {canEdit && (
                <form
                    onSubmit={handleSubmit}
                    className="space-y-2 rounded-2xl border bg-white px-4 py-3 text-xs"
                >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Add implant / prosthesis
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Name
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Lot number
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.lot_no}
                                onChange={(e) => handleChange('lot_no', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Serial number
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.serial_no}
                                onChange={(e) =>
                                    handleChange('serial_no', e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Manufacturer
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.manufacturer}
                                onChange={(e) =>
                                    handleChange('manufacturer', e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Expiry date
                            </label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.expiry_date}
                                onChange={(e) =>
                                    handleChange('expiry_date', e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Quantity
                            </label>
                            <input
                                type="number"
                                min="1"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.quantity}
                                onChange={(e) =>
                                    handleChange('quantity', e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Implant site
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.site}
                                onChange={(e) => handleChange('site', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Remarks
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.remarks}
                                onChange={(e) =>
                                    handleChange('remarks', e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                            )}
                            Add implant
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}




// ===========================
//   BLOOD TRANSFUSION TAB
// ===========================

function BloodTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.blood.view')
    const canEdit = useCan('ot.blood.manage') || useCan('ot.case.update')

    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        component: '',
        units: '1',
        blood_group: '',
        bag_no: '',
        start_time: '',
        end_time: '',
        reaction: '',
        reaction_action: '',
        notes: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await listBloodTransfusions(caseId)
            console.log(JSON.stringify(res), "vdajcjacja");

            setItems(res?.data || [])
        } catch (err) {
            console.error('Failed to load blood transfusions', err)
            setError('Failed to load blood transfusion records')
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
                You do not have permission to view OT blood transfusions.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return
        setSaving(true)
        try {
            const payload = {
                component: form.component || null,
                units: form.units === '' ? null : Number(form.units || 1),
                blood_group: form.blood_group || null,
                bag_no: form.bag_no || null,
                start_time: form.start_time || null,
                end_time: form.end_time || null,
                reaction: form.reaction || null,
                reaction_action: form.reaction_action || null,
                notes: form.notes || null,
            }
            await createBloodTransfusion(caseId, payload)
            setForm({
                component: '',
                units: '1',
                blood_group: '',
                bag_no: '',
                start_time: '',
                end_time: '',
                reaction: '',
                reaction_action: '',
                notes: '',
            })
            await load()
        } catch (err) {
            console.error('Failed to add transfusion', err)
            alert(
                err?.response?.data?.detail ||
                'Failed to add transfusion entry',
            )
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!canEdit) return
        if (!window.confirm('Delete this transfusion record?')) return
        try {
            await deleteBloodTransfusion(id)
            await load()
        } catch (err) {
            console.error('Failed to delete transfusion', err)
            alert('Failed to delete transfusion entry')
        }
    }

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border bg-white px-4 py-3 text-xs">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Droplets className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                            OT blood transfusion record
                        </span>
                    </div>
                </div>

                {loading && (
                    <div className="text-xs text-slate-500">
                        Loading transfusion records...
                    </div>
                )}
                {error && (
                    <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                <div className="max-h-64 overflow-auto rounded-xl border bg-slate-50">
                    <table className="min-w-full text-left text-[11px] text-slate-700">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-3 py-1.5">Component</th>
                                <th className="px-3 py-1.5">Units</th>
                                <th className="px-3 py-1.5">Group</th>
                                <th className="px-3 py-1.5">Bag no</th>
                                <th className="px-3 py-1.5">Start</th>
                                <th className="px-3 py-1.5">End</th>
                                <th className="px-3 py-1.5">Reaction</th>
                                <th className="px-3 py-1.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && items.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-3 py-2 text-center text-[11px] text-slate-500"
                                    >
                                        No transfusions recorded for this case.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                items?.events?.map((it) => (
                                    <tr key={it.id} className="border-t border-slate-100">
                                        <td className="px-3 py-1.5">
                                            {it.component || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.units ?? '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.blood_group || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.bag_no || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.start_time || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.end_time || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.reaction || 'None'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(it.case_id)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {canEdit && (
                <form
                    onSubmit={handleSubmit}
                    className="space-y-2 rounded-2xl border bg-white px-4 py-3 text-xs"
                >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Add transfusion entry
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Component
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.component}
                                onChange={(e) =>
                                    handleChange('component', e.target.value)
                                }
                                placeholder="PRBC / FFP / Platelets..."
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Units
                            </label>
                            <input
                                type="number"
                                min="1"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.units}
                                onChange={(e) => handleChange('units', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Blood group
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.blood_group}
                                onChange={(e) =>
                                    handleChange('blood_group', e.target.value)
                                }
                                placeholder="e.g., O+"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Bag number
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.bag_no}
                                onChange={(e) => handleChange('bag_no', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Start time
                            </label>
                            <input
                                type="time"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.start_time}
                                onChange={(e) =>
                                    handleChange('start_time', e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                End time
                            </label>
                            <input
                                type="time"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.end_time}
                                onChange={(e) => handleChange('end_time', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Reaction
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.reaction}
                                onChange={(e) =>
                                    handleChange('reaction', e.target.value)
                                }
                                placeholder="None / chills / rash / etc."
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Action taken
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.reaction_action}
                                onChange={(e) =>
                                    handleChange('reaction_action', e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                            Notes
                        </label>
                        <textarea
                            rows={2}
                            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                            value={form.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                            )}
                            Add transfusion
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}






// ===========================
//   LOGS TAB (OT cleaning logs for this case)
// ===========================

function LogsTab({ caseId }) {
    const canView = useCan('ot.logs.view') || useCan('ot.case.view')

    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await listCleaningLogs({ caseId })
            setLogs(res.data || [])
        } catch (err) {
            console.error('Failed to load OT logs', err)
            setError('Failed to load OT cleaning logs')
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
                You do not have permission to view OT logs.
            </div>
        )
    }

    return (
        <div className="rounded-2xl border bg-white px-4 py-3 text-xs">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-800">
                    <Thermometer className="h-4 w-4" />
                    <span className="text-sm font-semibold">OT cleaning / turnover logs</span>
                </div>
            </div>

            {loading && (
                <div className="text-xs text-slate-500">Loading OT logs...</div>
            )}

            {error && (
                <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="max-h-64 overflow-auto rounded-xl border bg-slate-50">
                <table className="min-w-full text-left text-[11px] text-slate-700">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="px-3 py-1.5">Date</th>
                            <th className="px-3 py-1.5">Theatre</th>
                            <th className="px-3 py-1.5">Session</th>
                            <th className="px-3 py-1.5">Type</th>
                            <th className="px-3 py-1.5">Done by</th>
                            <th className="px-3 py-1.5">Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && logs.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-3 py-2 text-center text-[11px] text-slate-500"
                                >
                                    No OT cleaning logs linked to this case.
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            logs.map((l) => (
                                <tr key={l.id} className="border-t border-slate-100">
                                    <td className="px-3 py-1.5">{l.date || '—'}</td>
                                    <td className="px-3 py-1.5">
                                        {l.theatre?.name || `#${l.theatre_id}`}
                                    </td>
                                    <td className="px-3 py-1.5">{l.session || '—'}</td>
                                    <td className="px-3 py-1.5">{l.cleaning_type || '—'}</td>
                                    <td className="px-3 py-1.5">
                                        {l.done_by_name || l.done_by_id || '—'}
                                    </td>
                                    <td className="px-3 py-1.5">{l.remarks || '—'}</td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ===========================
//   MAIN OT CASE DETAIL PAGE
// ===========================

export default function OtCaseDetailPage() {
    const { caseId } = useParams()
    console.log(caseId,"which data");
    
    const navigate = useNavigate()

    // 🔑 IMPORTANT: match backend permission code
    const canView = useCan('ot.cases.view')

    const [tab, setTab] = useState('preop')
    const [caseData, setCaseData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const loadCase = async () => {
        if (!canView || !caseId) return
        try {
            setLoading(true)
            setError(null)
            const res = await getOtCase(caseId)
            setCaseData(res.data || null)
        } catch (err) {
            console.error('Failed to load OT case', err)
            const status = err?.response?.status
            if (status === 404) {
                setError('OT case not found. It may have been deleted or the ID is invalid.')
            } else if (status === 403) {
                setError('You do not have permission to view this OT case.')
            } else {
                setError('Failed to load OT case. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadCase()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, canView])

    // 🧠 convenience variables
    const schedule = caseData?.schedule
    const patient = schedule?.patient
    const theatre = schedule?.theatre

    // 🔵 STATUS CHIP: derive from schedule.status or case.outcome
    const statusChip = useMemo(() => {
        if (!caseData) return null

        // Prefer schedule.status if available
        const rawStatus =
            schedule?.status || // planned / in_progress / completed / cancelled
            (caseData.outcome ? 'closed' : 'open')

        const s = String(rawStatus).toLowerCase()

        const map = {
            planned: 'bg-slate-100 text-slate-700',
            in_progress: 'bg-emerald-50 text-emerald-700',
            completed: 'bg-emerald-50 text-emerald-700',
            cancelled: 'bg-rose-50 text-rose-700',
            open: 'bg-emerald-50 text-emerald-700',
            closed: 'bg-slate-100 text-slate-700',
        }

        return (
            <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${map[s] || 'bg-slate-100 text-slate-700'
                    }`}
            >
                {String(rawStatus).toUpperCase()}
            </span>
        )
    }, [caseData, schedule])

    if (!canView) {
        return (
            <div className="p-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    You do not have permission to view OT cases.
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col gap-3 p-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-semibold text-slate-900">
                                OT Case #{caseId}
                            </h1>
                            {statusChip}
                        </div>
                        <p className="text-xs text-slate-500">
                            All OT records are linked to this case as per NABH OT documentation.
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            {/* Overview cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {/* Patient card */}
                <div className="rounded-2xl border bg-white px-4 py-3 text-xs">
                    <div className="mb-1 flex items-center gap-2 text-slate-700">
                        <User className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Patient
                        </span>
                    </div>

                    <div className="text-sm font-medium text-slate-900">
                        {patient?.full_name ||
                            (patient?.uhid && `UHID ${patient.uhid}`) ||
                            (schedule?.patient_id && `UHID #${schedule.patient_id}`) ||
                            '—'}
                    </div>

                    {schedule?.admission_id && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                            IP #{schedule.admission_id}
                        </div>
                    )}
                </div>

                {/* Procedure & surgeon */}
                <div className="rounded-2xl border bg-white px-4 py-3 text-xs">
                    <div className="mb-1 flex items-center gap-2 text-slate-700">
                        <Stethoscope className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Procedure & Surgeon
                        </span>
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                        {caseData?.final_procedure_name ||
                            schedule?.procedure_name ||
                            '—'}
                    </div>

                    <div className="mt-0.5 text-[11px] text-slate-500">
                        Surgeon:{' '}
                        {schedule?.surgeon?.full_name
                            ? schedule.surgeon.full_name
                            : schedule?.surgeon_user_id
                                ? `Dr #${schedule.surgeon_user_id}`
                                : '—'}
                    </div>

                    <div className="mt-0.5 text-[11px] text-slate-500">
                        Anaesthetist:{' '}
                        {schedule?.anaesthetist?.full_name
                            ? schedule.anaesthetist.full_name
                            : schedule?.anaesthetist_user_id
                                ? `#${schedule.anaesthetist_user_id}`
                                : '—'}
                    </div>
                </div>

                {/* Theatre & timings */}
                <div className="rounded-2xl border bg-white px-4 py-3 text-xs">
                    <div className="mb-1 flex items-center gap-2 text-slate-700">
                        <Clock3 className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Theatre & Timings
                        </span>
                    </div>

                    <div className="text-sm font-medium text-slate-900">
                        {theatre?.name ||
                            (schedule?.theatre_id && `OT #${schedule.theatre_id}`) ||
                            '—'}
                    </div>

                    <div className="mt-0.5 text-[11px] text-slate-500">
                        Planned:{' '}
                        {schedule?.planned_start_time && schedule?.planned_end_time
                            ? `${schedule.planned_start_time} – ${schedule.planned_end_time}`
                            : schedule?.planned_start_time
                                ? `${schedule.planned_start_time}`
                                : '—'}
                    </div>

                    <div className="mt-0.5 text-[11px] text-slate-500">
                        Actual start:{' '}
                        {caseData?.actual_start_time || '—'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                        Actual end:{' '}
                        {caseData?.actual_end_time || '—'}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 pt-1">
                {TABS.map((t) => {
                    const active = t.id === tab
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${active
                                ? 'text-sky-700'
                                : 'text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            {t.label}
                            {active && (
                                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-sky-600" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto pt-2 pb-4">
                {loading && !caseData && (
                    <div className="rounded-2xl border bg-white px-4 py-4 text-xs text-slate-500">
                        Loading OT case...
                    </div>
                )}

                {!loading && !caseData && !error && (
                    <div className="rounded-2xl border bg-white px-4 py-4 text-xs text-slate-500">
                        OT case not loaded.
                    </div>
                )}

                {caseData && (
                    <div className="space-y-3">
                        {tab === 'preop' && <PreopTab caseId={caseId} />}
                        {tab === 'safety' && <SafetyTab caseId={caseId} />}
                        {tab === 'anaesthesia' && (
                            <AnaesthesiaTab caseId={caseId} />
                        )}
                        {tab === 'nursing' && <NursingTab caseId={caseId} />}
                        {tab === 'counts' && <CountsTab caseId={caseId} />}
                        {tab === 'implants' && <ImplantsTab caseId={caseId} />}
                        {tab === 'blood' && <BloodTab caseId={caseId} />}
                        {tab === 'notes' && (
                            <OperationNotesTab caseId={caseId} />
                        )}
                        {tab === 'pacu' && <PacuTab caseId={caseId} />}
                        {tab === 'logs' && <LogsTab caseId={caseId} />}
                    </div>
                )}
            </div>
        </div>
    )
}