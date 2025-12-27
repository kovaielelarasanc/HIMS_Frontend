// FILE: frontend/src/ipd/tabs/Medications.jsx
import { useEffect, useMemo, useState } from 'react'
import {
    listMedications,
    addMedication,
    updateMedication,
    getDrugChartMeta,
    saveDrugChartMeta,
    listIvFluids,
    addIvFluid,
    updateIvFluid,
    deleteIvFluid,
    listDrugChartNurses,
    addDrugChartNurse,
    deleteDrugChartNurse,
    listDoctorAuths,
    addDoctorAuth,
    deleteDoctorAuth,
    downloadDrugChartPdf,
} from '../../api/ipd'
import { toast } from 'sonner'

const ROUTES = ['po', 'iv', 'im', 'sc', 'topical', 'nebulisation']
const FREQ_OPTIONS = ['od', 'bd', 'tds', 'qid', 'stat', 'prn']
const DOSE_UNITS = ['mg', 'g', 'ml', 'units', 'drops', 'puffs', 'tab', 'cap', 'sachet']
const ORDER_TYPES = [
    { value: 'regular', label: 'Regular' },
    { value: 'sos', label: 'SOS' },
    { value: 'stat_premed', label: 'STAT / Premed' },
]
function MedicationsTab({ admissionId, canWrite = true }) {
    // ------------ GLOBAL STATE ------------
    const [loadingAll, setLoadingAll] = useState(false)
    const [downloadBusy, setDownloadBusy] = useState(false)


    // Meta header
    const [meta, setMeta] = useState({
        allergies: '',
        diagnosis: '',
        weight_kg: '',
        height_cm: '',
        blood_group: '',
        bsa: '',
        bmi: '',
        diet_oral_fluid_per_day: '',
        diet_salt_gm_per_day: '',
        diet_calorie_per_day: '',
        diet_protein_gm_per_day: '',
        diet_remarks: '',
    })

    // helpers (put near top of component)
    const toIsoSecs = (v) => (!v ? null : v.length === 16 ? `${v}:00` : v)

    const strOrNull = (v) => {
        const s = String(v ?? '').trim()
        return s ? s : null
    }

    const numOrNull = (v) => {
        const s = String(v ?? '').trim()
        if (!s) return null
        const n = Number(s)
        return Number.isFinite(n) ? n : null
    }

    const formatIST = (iso) => {
        if (!iso) return '—'
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return String(iso)
        return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }

    // state
    const [ivForm, setIvForm] = useState({
        ordered_datetime: '',
        fluid: '',
        additive: '',
        dose_ml: '',
        rate_ml_per_hr: '',
        start_datetime: '',
        stop_datetime: '',
        remarks: '',
    })

    const handleIvChange = (k) => (e) =>
        setIvForm((p) => ({ ...p, [k]: e.target.value }))


    // IV fluids
    const [ivRows, setIvRows] = useState([])

    const [ivSaving, setIvSaving] = useState(false)

    // Nurses
    const [nurseRows, setNurseRows] = useState([])
    const [nurseForm, setNurseForm] = useState({
        name: '',
        specimen: '',
        emp_no: '',
    })
    const [nurseSaving, setNurseSaving] = useState(false)

    // Doctor auth
    const [authRows, setAuthRows] = useState([])
    const [authForm, setAuthForm] = useState({
        date: '',
        remarks: '',
    })
    const [authSaving, setAuthSaving] = useState(false)

    // Med orders (main drug grid)
    const [medRows, setMedRows] = useState([])
    const [medErr, setMedErr] = useState('')
    const [medLoading, setMedLoading] = useState(false)
    const [medSaving, setMedSaving] = useState(false)
    const [showActiveOnly, setShowActiveOnly] = useState(true)
    const [orderTypeFilter, setOrderTypeFilter] = useState('all')

    const [medForm, setMedForm] = useState({
        drug_name: '',
        order_type: 'regular',
        route: 'iv',
        frequency: 'bd',
        dose_value: '',
        dose_unit: 'mg',
        start_date: '',
        end_date: '',
        duration_days: '',
        instructions: '',
    })

    const hasMedRows = useMemo(
        () => Array.isArray(medRows) && medRows.length > 0,
        [medRows]
    )

    const filteredMedRows = useMemo(() => {
        let rows = medRows
        if (showActiveOnly) {
            rows = rows.filter((r) => (r.order_status || 'active') !== 'stopped')
        }
        if (orderTypeFilter !== 'all') {
            rows = rows.filter((r) => (r.order_type || 'regular') === orderTypeFilter)
        }
        return rows
    }, [medRows, showActiveOnly, orderTypeFilter])

    // ------------ COMMON HELPERS ------------

    const formatDate = (v) => {
        if (!v) return '—'
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return '—'
        return d.toLocaleDateString()
    }

    const formatDateOnly = (v) => {
        if (!v) return ''
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return ''
        return d.toISOString().slice(0, 10)
    }

    const formatDose = (row) => {
        if (row.dose == null && !row.dose_unit) return '—'
        if (row.dose == null) return row.dose_unit || '—'
        return `${row.dose} ${row.dose_unit || ''}`.trim()
    }

    const statusBadgeClass = (status) => {
        const s = status || 'active'
        if (s === 'stopped') {
            return 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600'
        }
        if (s === 'completed') {
            return 'inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700'
        }
        return 'inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700'
    }

    // ------------ BMI AUTO-CALC ------------
    useEffect(() => {
        const weight = Number(meta.weight_kg)
        const height = Number(meta.height_cm)
        if (!weight || !height || Number.isNaN(weight) || Number.isNaN(height)) {
            setMeta((s) => ({ ...s, bmi: '' }))
            return
        }
        const hM = height / 100
        if (!hM) {
            setMeta((s) => ({ ...s, bmi: '' }))
            return
        }
        const bmi = weight / (hM * hM)
        setMeta((s) => ({ ...s, bmi: bmi.toFixed(1) }))
    }, [meta.weight_kg, meta.height_cm])

    // ------------ LOAD ALL SECTIONS ------------

    const loadMeta = async () => {
        if (!admissionId) return
        try {
            const { data } = await getDrugChartMeta(admissionId)
            if (data) {
                setMeta({
                    allergies: data.allergic_to || '',
                    diagnosis: data.diagnosis || '',
                    weight_kg: data.weight_kg ?? '',
                    height_cm: data.height_cm ?? '',
                    blood_group: data.blood_group || '',
                    bsa: data.bsa ?? '',
                    bmi: data.bmi ?? '',
                    diet_oral_fluid_per_day: data.oral_fluid_per_day_ml ?? '',
                    diet_salt_gm_per_day: data.salt_gm_per_day ?? '',
                    diet_calorie_per_day: data.calorie_per_day_kcal ?? '',
                    diet_protein_gm_per_day: data.protein_gm_per_day ?? '',
                    diet_remarks: data.diet_remarks || '',
                })
            }
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
            // silent
        }
    }

    const loadIvFluids = async () => {
        if (!admissionId) return
        try {
            const { data } = await listIvFluids(admissionId)
            setIvRows(Array.isArray(data) ? data : [])
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
            // silent
        }
    }

    const loadNurses = async () => {
        if (!admissionId) return
        try {
            const { data } = await listDrugChartNurses(admissionId)
            setNurseRows(Array.isArray(data) ? data : [])
        } catch {
            // silent
        }
    }

    const loadAuths = async () => {
        if (!admissionId) return
        try {
            const { data } = await listDoctorAuths(admissionId)
            setAuthRows(Array.isArray(data) ? data : [])
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
            // silent
        }
    }

    const loadMeds = async () => {
        if (!admissionId) return
        setMedLoading(true)
        setMedErr('')
        try {
            const { data } = await listMedications(admissionId)
            console.log(data, "listMedications");
            setMedRows(Array.isArray(data) ? data : [])
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            setMedErr(msg)
            toast.error(msg)
        } finally {
            setMedLoading(false)
        }
    }

    const loadAll = async () => {
        if (!admissionId) return
        setLoadingAll(true)
        await Promise.all([
            loadMeta(),
            loadIvFluids(),
            loadNurses(),
            loadAuths(),
            loadMeds(),
        ])
        setLoadingAll(false)
    }

    useEffect(() => {
        loadAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    // ------------ HANDLERS: META (HEADER) ------------

    const handleMetaChange = (field) => (e) => {
        const value = e.target.value
        setMeta((s) => ({ ...s, [field]: value }))
    }

    const saveMeta = async () => {
        if (!admissionId) return
        try {
            const payload = {
                allergic_to: meta.allergies || '',
                diagnosis: meta.diagnosis || '',
                weight_kg:
                    meta.weight_kg !== '' && !Number.isNaN(Number(meta.weight_kg))
                        ? Number(meta.weight_kg)
                        : NoneOrNull(meta.weight_kg),
                height_cm:
                    meta.height_cm !== '' && !Number.isNaN(Number(meta.height_cm))
                        ? Number(meta.height_cm)
                        : NoneOrNull(meta.height_cm),
                blood_group: meta.blood_group || '',
                bsa:
                    meta.bsa !== '' && !Number.isNaN(Number(meta.bsa))
                        ? Number(meta.bsa)
                        : NoneOrNull(meta.bsa),
                bmi:
                    meta.bmi !== '' && !Number.isNaN(Number(meta.bmi))
                        ? Number(meta.bmi)
                        : NoneOrNull(meta.bmi),
                oral_fluid_per_day_ml:
                    meta.diet_oral_fluid_per_day !== '' &&
                        !Number.isNaN(Number(meta.diet_oral_fluid_per_day))
                        ? Number(meta.diet_oral_fluid_per_day)
                        : NoneOrNull(meta.diet_oral_fluid_per_day),
                salt_gm_per_day:
                    meta.diet_salt_gm_per_day !== '' &&
                        !Number.isNaN(Number(meta.diet_salt_gm_per_day))
                        ? Number(meta.diet_salt_gm_per_day)
                        : NoneOrNull(meta.diet_salt_gm_per_day),
                calorie_per_day_kcal:
                    meta.diet_calorie_per_day !== '' &&
                        !Number.isNaN(Number(meta.diet_calorie_per_day))
                        ? Number(meta.diet_calorie_per_day)
                        : NoneOrNull(meta.diet_calorie_per_day),
                protein_gm_per_day:
                    meta.diet_protein_gm_per_day !== '' &&
                        !Number.isNaN(Number(meta.diet_protein_gm_per_day))
                        ? Number(meta.diet_protein_gm_per_day)
                        : NoneOrNull(meta.diet_protein_gm_per_day),
                diet_remarks: meta.diet_remarks || '',
            }
            await saveDrugChartMeta(admissionId, payload)
            toast.success('Drug chart header details updated')
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
        }
    }

    const NoneOrNull = (val) => (val === '' || val == null ? null : val)

    // ------------ HANDLERS: IV FLUIDS ------------



    const addIv = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return

        if (!ivForm.fluid.trim()) {
            toast.error('Please enter IV fluid')
            return
        }

        try {
            setIvSaving(true)

            const payload = {
                ordered_datetime: toIsoSecs(ivForm.ordered_datetime),
                fluid: ivForm.fluid.trim(),
                additive: strOrNull(ivForm.additive),
                dose_ml: numOrNull(ivForm.dose_ml),
                rate_ml_per_hr: numOrNull(ivForm.rate_ml_per_hr),
                start_datetime: toIsoSecs(ivForm.start_datetime),
                stop_datetime: toIsoSecs(ivForm.stop_datetime),
                remarks: strOrNull(ivForm.remarks),
            }

            await addIvFluid(admissionId, payload)

            setIvForm({
                ordered_datetime: '',
                fluid: '',
                additive: '',
                dose_ml: '',
                rate_ml_per_hr: '',
                start_datetime: '',
                stop_datetime: '',
                remarks: '',
            })

            await loadIvFluids()
            toast.success('IV fluid order added')
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to add IV fluid')
            toast.error(msg)
        } finally {
            setIvSaving(false)
        }
    }

    const removeIv = async (row) => {
        if (!canWrite) return
        const ok = window.confirm(`Remove IV fluid "${row.fluid}"?`)
        if (!ok) return
        try {
            await deleteIvFluid(row.id)
            await loadIvFluids()
            toast.success('IV fluid deleted')
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
        }
    }

    // ------------ HANDLERS: NURSE SIGNATURES ------------

    const handleNurseChange = (field) => (e) => {
        const value = e.target.value
        setNurseForm((s) => ({ ...s, [field]: value }))
    }

    const addNurse = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return
        if (!nurseForm.name.trim()) {
            toast.error('Please enter nurse name')
            return
        }
        try {
            setNurseSaving(true)
            const payload = {
                admission_id: admissionId,
                nurse_name: nurseForm.name.trim(),
                specimen_sign: nurseForm.specimen || '',
                emp_no: nurseForm.emp_no || '',
            }
            await addDrugChartNurse(admissionId, payload)
            setNurseForm({ name: '', specimen: '', emp_no: '' })
            await loadNurses()
            toast.success('Nurse row added')
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
        } finally {
            setNurseSaving(false)
        }
    }

    const removeNurse = async (row) => {
        if (!canWrite) return
        const ok = window.confirm(`Remove nurse "${row.nurse_name}"?`)
        if (!ok) return
        try {
            await deleteDrugChartNurse(row.id)
            await loadNurses()
            toast.success('Nurse row deleted')
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
        }
    }

    // ------------ HANDLERS: DOCTOR AUTH ------------

    const handleAuthChange = (field) => (e) => {
        const value = e.target.value
        setAuthForm((s) => ({ ...s, [field]: value }))
    }

    const addAuth = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return
        if (!authForm.date) {
            toast.error('Please select date')
            return
        }
        try {
            setAuthSaving(true)
            const payload = {
                admission_id:admissionId,
                auth_date: authForm.date,
                remarks: authForm.remarks || '',
            }
            await addDoctorAuth(admissionId, payload)
            setAuthForm({ date: '', remarks: '' })
            await loadAuths()
            toast.success("Doctor's daily authorization added")
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
        } finally {
            setAuthSaving(false)
        }
    }

    const removeAuth = async (row) => {
        if (!canWrite) return
        const ok = window.confirm(
            `Remove authorization entry for ${formatDate(row.date)}?`
        )
        if (!ok) return
        try {
            await deleteDoctorAuth(row.id)
            await loadAuths()
            toast.success('Authorization entry deleted')
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
        }
    }

    // ------------ HANDLERS: MEDICATION ORDERS ------------

    const handleMedChange = (field) => (e) => {
        const value = e.target.value
        setMedForm((s) => ({ ...s, [field]: value }))
    }

    const resetMedForm = () =>
        setMedForm({
            drug_name: '',
            order_type: 'regular',
            route: 'iv',
            frequency: 'bd',
            dose_value: '',
            dose_unit: 'mg',
            start_date: '',
            end_date: '',
            duration_days: '',
            instructions: '',
        })

    const addMed = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return

        // --- VALIDATION ---
        const name = medForm.drug_name.trim()
        if (!name) {
            toast.error('Please enter a drug name')
            return
        }

        // Dose must always be STRING (avoid 422)
        const doseStr =
            medForm.dose_value &&
                String(medForm.dose_value).trim() !== ''
                ? String(medForm.dose_value).trim()
                : ''

        // Dose numeric validation (optional)
        const doseNum = medForm.dose_value.trim()
            ? Number(medForm.dose_value)
            : null
        if (medForm.dose_value && Number.isNaN(doseNum)) {
            toast.error('Dose must be a number (e.g. 500)')
            return
        }

        // Duration numeric validation
        const durNum = medForm.duration_days.trim()
            ? Number(medForm.duration_days)
            : null
        if (
            medForm.duration_days &&
            (Number.isNaN(durNum) || !Number.isInteger(durNum))
        ) {
            toast.error('Duration must be whole days (e.g. 5)')
            return
        }

        // Build ISO date strings for backend
        const startIso = medForm.start_date
            ? `${medForm.start_date}T00:00:00`
            : null
        const stopIso = medForm.end_date
            ? `${medForm.end_date}T00:00:00`
            : null

        // --- FINAL PAYLOAD MATCHING BACKEND MODEL EXACTLY ---
        const payload = {
            drug_id: null, // optional
            drug_name: name,
            order_type: medForm.order_type || 'regular', // regular / sos / stat / premed
            route: medForm.route || 'iv',
            frequency: medForm.frequency || 'bd',
            dose: doseStr,            // ALWAYS STRING → FIXES 422
            dose_unit: medForm.dose_unit || '',
            duration_days: durNum,
            start_datetime: startIso,
            stop_datetime: stopIso,
            special_instructions: medForm.instructions || '',
            order_status: 'active',
        }

        // --- API CALL ---
        try {
            setMedSaving(true)
            await addMedication(admissionId, payload)
            toast.success('Medication order added')
            resetMedForm()
            await loadMeds()
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to add medication')
            toast.error(msg)
        } finally {
            setMedSaving(false)
        }
    }


    const stopMed = async (row) => {
        console.log(row, "roe");
        if (!canWrite) return
        if ((row.order_status || 'active') === 'stopped') return

        const ok = window.confirm(`Stop "${row.drug_name}" for this admission?`)
        if (!ok) return

        try {
            const nowIso = new Date().toISOString()
            await updateMedication(row.id, {
                order_status: 'stopped',
                stop_datetime: row.stop_datetime || nowIso,
            })
            toast.success('Medication stopped')
            await loadMeds()
        } catch (e) {
            const msg = extractApiErrorMessage(e, 'Failed to load medications')
            toast.error(msg)
        }
    }

    // ------------ DOWNLOAD PDF ------------

    const handleDownloadPdf = async () => {
        if (!admissionId) return
        try {
            setDownloadBusy(true)
            const res = await downloadDrugChartPdf(admissionId)
            const blob = new Blob([res.data], { type: 'application/pdf' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `drug-chart-${admissionId}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to download drug chart PDF'
            toast.error(msg)
        } finally {
            setDownloadBusy(false)
        }
    }

    // ------------ UI ------------

    return (
        <div className="space-y-4 text-sm text-slate-900">
            {/* MAIN HEADER */}
            <div className="flex flex-col gap-2 rounded-2xl border bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 p-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-900">
                        IPD Drug Chart – NABH Format
                    </h2>
                    <p className="text-[11px] text-slate-700 leading-snug">
                        This page captures the complete <strong>inpatient medication and drug chart</strong>{' '}
                        as per NABH style: patient details, allergies, diagnosis, IV fluids, main drug grid
                        with hours/sign, SOS &amp; STAT orders, nurse signatures and daily doctor
                        authorisation. All entries can be used for the <strong>official Drug Chart PDF</strong>.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={loadAll}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] text-slate-700 shadow-sm hover:bg-slate-50"
                        disabled={loadingAll}
                    >
                        {loadingAll ? 'Refreshing…' : 'Refresh'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                        disabled={downloadBusy}
                    >
                        {downloadBusy ? 'Preparing PDF…' : 'Download Drug Chart PDF'}
                    </button>
                </div>
            </div>

            {/* TOP: PATIENT META + DIET / BMI */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Patient info + allergies / diagnosis */}
                <div className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-800">
                            Patient details &amp; clinical header
                        </h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Allergic to
                            </label>
                            <input
                                className="input h-9 text-sm"
                                placeholder="e.g. Penicillin, NSAIDs"
                                value={meta.allergies}
                                onChange={handleMetaChange('allergies')}
                                disabled={!canWrite}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Diagnosis
                            </label>
                            <textarea
                                className="input min-h-[48px] text-sm"
                                placeholder="Primary / secondary diagnosis"
                                value={meta.diagnosis}
                                onChange={handleMetaChange('diagnosis')}
                                disabled={!canWrite}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Weight (kg)
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input h-9 text-sm"
                                value={meta.weight_kg}
                                onChange={handleMetaChange('weight_kg')}
                                disabled={!canWrite}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Height (cm)
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input h-9 text-sm"
                                value={meta.height_cm}
                                onChange={handleMetaChange('height_cm')}
                                disabled={!canWrite}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Blood group
                            </label>
                            <input
                                className="input h-9 text-sm uppercase"
                                placeholder="e.g. B+"
                                value={meta.blood_group}
                                onChange={handleMetaChange('blood_group')}
                                disabled={!canWrite}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                BSA (m²)
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input h-9 text-sm"
                                value={meta.bsa}
                                onChange={handleMetaChange('bsa')}
                                disabled={!canWrite}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                BMI (kg/m²)
                            </label>
                            <input
                                className="input h-9 text-sm bg-slate-50"
                                value={meta.bmi}
                                readOnly
                            />
                            <p className="mt-1 text-[10px] text-slate-400">
                                Auto-calculated from weight &amp; height.
                            </p>
                        </div>
                    </div>
                    {canWrite && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={saveMeta}
                                className="btn"
                            >
                                Save header
                            </button>
                        </div>
                    )}
                </div>

                {/* Dietary advice */}
                <div className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-semibold text-slate-800">
                        Dietary advice (per day)
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Oral fluid (ml/day)
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input h-9 text-sm"
                                value={meta.diet_oral_fluid_per_day}
                                onChange={handleMetaChange('diet_oral_fluid_per_day')}
                                disabled={!canWrite}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Salt (gm/day)
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input h-9 text-sm"
                                value={meta.diet_salt_gm_per_day}
                                onChange={handleMetaChange('diet_salt_gm_per_day')}
                                disabled={!canWrite}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Calories (kcal/day)
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input h-9 text-sm"
                                value={meta.diet_calorie_per_day}
                                onChange={handleMetaChange('diet_calorie_per_day')}
                                disabled={!canWrite}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Protein (gm/day)
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input h-9 text-sm"
                                value={meta.diet_protein_gm_per_day}
                                onChange={handleMetaChange('diet_protein_gm_per_day')}
                                disabled={!canWrite}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            Dietary remarks
                        </label>
                        <textarea
                            className="input min-h-[48px] text-sm"
                            placeholder="Any additional diet advice / restrictions"
                            value={meta.diet_remarks}
                            onChange={handleMetaChange('diet_remarks')}
                            disabled={!canWrite}
                        />
                    </div>
                    {canWrite && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={saveMeta}
                                className="rounded-full border border-slate-500 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            >
                                Save diet
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* IV FLUID ORDERS */}
            <div className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-800">
                        Intravenous fluids
                    </h3>
                </div>

                {canWrite && (
                    <form onSubmit={addIv} className="grid gap-2 md:grid-cols-12">
                        <div className="md:col-span-3">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Ordered date & time
                            </label>
                            <input
                                type="datetime-local"
                                className="input h-9 text-sm w-full"
                                value={ivForm.ordered_datetime}
                                onChange={handleIvChange('ordered_datetime')}
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Fluid
                            </label>
                            <input
                                className="input h-9 text-sm w-full"
                                placeholder="e.g. DNS"
                                value={ivForm.fluid}
                                onChange={handleIvChange('fluid')}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Additive (if any)
                            </label>
                            <input
                                className="input h-9 text-sm w-full"
                                value={ivForm.additive}
                                onChange={handleIvChange('additive')}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Dose (ml)
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input h-9 text-sm w-full"
                                placeholder="e.g. 500"
                                value={ivForm.dose_ml}
                                onChange={handleIvChange('dose_ml')}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Rate (ml/hr)
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input h-9 text-sm w-full"
                                value={ivForm.rate_ml_per_hr}
                                onChange={handleIvChange('rate_ml_per_hr')}
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Start date & time
                            </label>
                            <input
                                type="datetime-local"
                                className="input h-9 text-sm w-full"
                                value={ivForm.start_datetime}
                                onChange={handleIvChange('start_datetime')}
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Stop date & time
                            </label>
                            <input
                                type="datetime-local"
                                className="input h-9 text-sm w-full"
                                value={ivForm.stop_datetime}
                                onChange={handleIvChange('stop_datetime')}
                            />
                        </div>

                        <div className="md:col-span-4">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Remarks
                            </label>
                            <input
                                className="input h-9 text-sm w-full"
                                placeholder="Doctor sign / notes"
                                value={ivForm.remarks}
                                onChange={handleIvChange('remarks')}
                            />
                        </div>

                        <div className="md:col-span-2 flex items-end justify-end">
                            <button type="submit" className="btn w-full md:w-auto" disabled={ivSaving}>
                                {ivSaving ? 'Saving…' : 'Add IV fluid'}
                            </button>
                        </div>
                    </form>
                )}
                <div className="overflow-auto rounded-xl border bg-slate-50">
                    <table className="w-full text-[11px] md:text-xs">
                        <thead>
                            <tr className="bg-slate-100 text-slate-600">
                                <th className="px-2 py-2 text-left">Ordered</th>
                                <th className="px-2 py-2 text-left">Fluid</th>
                                <th className="px-2 py-2 text-left">Additive</th>
                                <th className="px-2 py-2 text-left">Dose (ml)</th>
                                <th className="px-2 py-2 text-left">Rate (ml/hr)</th>
                                <th className="px-2 py-2 text-left">Start</th>
                                <th className="px-2 py-2 text-left">Stop</th>
                                <th className="px-2 py-2 text-left">Remarks</th>
                                {canWrite && <th className="px-2 py-2" />}
                            </tr>
                        </thead>

                        <tbody>
                            {ivRows.length ? (
                                ivRows.map((r) => (
                                    <tr key={r.id} className="border-t bg-white">
                                        <td className="px-2 py-1">{formatIST(r.ordered_datetime)}</td>
                                        <td className="px-2 py-1">{r.fluid || '—'}</td>
                                        <td className="px-2 py-1">{r.additive || '—'}</td>
                                        <td className="px-2 py-1">
                                            {r.dose_ml != null ? r.dose_ml : '—'}
                                        </td>
                                        <td className="px-2 py-1">
                                            {r.rate_ml_per_hr != null ? r.rate_ml_per_hr : '—'}
                                        </td>
                                        <td className="px-2 py-1">{formatIST(r.start_datetime)}</td>
                                        <td className="px-2 py-1">{formatIST(r.stop_datetime)}</td>
                                        <td className="px-2 py-1">{r.remarks || '—'}</td>

                                        {/* {canWrite && (
                                            <td className="px-2 py-1 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => removeIv(r)}
                                                    className="text-[10px] text-rose-600 underline hover:text-rose-700"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        )} */}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        className="px-3 py-3 text-center text-[11px] text-slate-500"
                                        colSpan={canWrite ? 9 : 8}
                                    >
                                        No IV fluids recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MAIN MEDICATION GRID */}
            <div className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-xs font-semibold text-slate-800">
                        Drug orders (Regular / SOS / STAT &amp; Premed)
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowActiveOnly((v) => !v)}
                            className={`rounded-full border px-3 py-1 text-[11px] ${showActiveOnly
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-slate-300 bg-white text-slate-600'
                                }`}
                        >
                            {showActiveOnly ? 'Showing active only' : 'Showing all orders'}
                        </button>
                        <div className="flex gap-1 rounded-full bg-slate-50 p-1 text-[11px]">
                            <button
                                type="button"
                                onClick={() => setOrderTypeFilter('all')}
                                className={`rounded-full px-2 py-0.5 ${orderTypeFilter === 'all'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600'
                                    }`}
                            >
                                All
                            </button>
                            {ORDER_TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setOrderTypeFilter(t.value)}
                                    className={`rounded-full px-2 py-0.5 ${orderTypeFilter === t.value
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-600'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {medErr && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {medErr}
                    </div>
                )}

                {/* Add form */}
                {canWrite && (
                    <form
                        onSubmit={addMed}
                        className="space-y-3 rounded-2xl border bg-slate-50 p-3 md:p-4"
                    >
                        <div className="grid gap-3 md:grid-cols-6">
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                    Drug name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    className="input h-9 text-sm"
                                    placeholder="e.g. Tab. Paracetamol"
                                    value={medForm.drug_name}
                                    onChange={handleMedChange('drug_name')}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                    Order type
                                </label>
                                <select
                                    className="input h-9 text-sm"
                                    value={medForm.order_type}
                                    onChange={handleMedChange('order_type')}
                                >
                                    {ORDER_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                    Route
                                </label>
                                <select
                                    className="input h-9 text-sm"
                                    value={medForm.route}
                                    onChange={handleMedChange('route')}
                                >
                                    {ROUTES.map((r) => (
                                        <option key={r} value={r}>
                                            {r.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                    Frequency
                                </label>
                                <select
                                    className="input h-9 text-sm"
                                    value={medForm.frequency}
                                    onChange={handleMedChange('frequency')}
                                >
                                    {FREQ_OPTIONS.map((f) => (
                                        <option key={f} value={f}>
                                            {f.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                    Dose
                                </label>
                                <div className="flex gap-1">
                                    <input
                                        className="input h-9 w-1/2 text-sm"
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="e.g. 500"
                                        value={medForm.dose_value}
                                        onChange={handleMedChange('dose_value')}
                                    />
                                    <select
                                        className="input h-9 w-1/2 text-sm"
                                        value={medForm.dose_unit}
                                        onChange={handleMedChange('dose_unit')}
                                    >
                                        {DOSE_UNITS.map((u) => (
                                            <option key={u} value={u}>
                                                {u}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-5">
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                    Start date
                                </label>
                                <input
                                    type="date"
                                    className="input h-9 text-sm"
                                    value={medForm.start_date}
                                    onChange={handleMedChange('start_date')}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                    Planned end date
                                </label>
                                <input
                                    type="date"
                                    className="input h-9 text-sm"
                                    value={medForm.end_date}
                                    onChange={handleMedChange('end_date')}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                    Duration (days)
                                </label>
                                <input
                                    className="input h-9 text-sm"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="e.g. 5"
                                    value={medForm.duration_days}
                                    onChange={handleMedChange('duration_days')}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                    Special instructions
                                </label>
                                <textarea
                                    className="input min-h-[48px] text-sm"
                                    placeholder="e.g. Before food, monitor BP, tapering etc."
                                    value={medForm.instructions}
                                    onChange={handleMedChange('instructions')}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={resetMedForm}
                                className="rounded-full border border-slate-500 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                                Clear
                            </button>
                            <button
                                type="submit"
                                className="btn"
                                disabled={medSaving || !canWrite}
                            >
                                {medSaving ? 'Saving…' : 'Add medication'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Med table */}
                <div className="overflow-auto rounded-2xl border bg-white">
                    <table className="w-full text-[11px] md:text-xs">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500">
                                <th className="px-2 py-2 text-left md:px-3">Type</th>
                                <th className="px-2 py-2 text-left md:px-3">Drug</th>
                                <th className="px-2 py-2 text-left md:px-3">Route</th>
                                <th className="px-2 py-2 text-left md:px-3">Freq</th>
                                <th className="px-2 py-2 text-left md:px-3">Dose</th>
                                <th className="px-2 py-2 text-left md:px-3">Start</th>
                                <th className="px-2 py-2 text-left md:px-3">End</th>
                                <th className="px-2 py-2 text-left md:px-3">Instructions</th>
                                <th className="px-2 py-2 text-left md:px-3">Status</th>
                                {canWrite && <th className="px-2 py-2 md:px-3" />}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMedRows.length ? (
                                filteredMedRows.map((r) => (
                                    <tr key={r.id} className="border-t align-top text-slate-800">
                                        <td className="px-2 py-2 md:px-3">
                                            {(r.order_type === 'sos' && 'SOS') ||
                                                (r.order_type === 'stat_premed' && 'STAT / Premed') ||
                                                'Regular'}
                                        </td>
                                        <td className="px-2 py-2 md:px-3">
                                            {r.drug_name || '—'}
                                        </td>
                                        <td className="px-2 py-2 uppercase md:px-3">
                                            {r.route || '—'}
                                        </td>
                                        <td className="px-2 py-2 uppercase md:px-3">
                                            {r.frequency || '—'}
                                        </td>
                                        <td className="px-2 py-2 md:px-3">
                                            {formatDose(r)}
                                        </td>
                                        <td className="px-2 py-2 md:px-3">
                                            {formatDate(r.start_datetime)}
                                        </td>
                                        <td className="px-2 py-2 md:px-3">
                                            {formatDate(r.stop_datetime)}
                                        </td>
                                        <td className="whitespace-pre-wrap px-2 py-2 md:px-3">
                                            {r.special_instructions || '—'}
                                        </td>
                                        <td className="px-2 py-2 md:px-3">
                                            <span className={statusBadgeClass(r.order_status)}>
                                                {r.order_status || 'active'}
                                            </span>
                                        </td>
                                        {canWrite && (
                                            <td className="px-2 py-2 text-right md:px-3">
                                                {(r.order_status || 'active') !== 'stopped' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => stopMed(r)}
                                                        className="text-[10px] text-rose-600 underline hover:text-rose-700"
                                                    >
                                                        Stop
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        className="px-3 py-3 text-center text-xs text-slate-500"
                                        colSpan={canWrite ? 10 : 9}
                                    >
                                        {medLoading
                                            ? 'Loading medication orders…'
                                            : 'No medications recorded for this admission.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* NOTE text per NABH */}
                <p className="text-[10px] text-slate-500">
                    <strong>Note:</strong> If medicines are not administered, indicate as{' '}
                    <strong>NOT GIVEN</strong> in the drug chart and document the reason in
                    nurses notes. Verbal orders should be clearly marked (e.g. &apos;V&apos;)
                    and read-back practiced for all orders. Verbal orders are{' '}
                    <strong>not accepted for high-risk drugs</strong> and must be signed by
                    the ordering doctor within 24 hours.
                </p>
            </div>

            {/* NURSE SIGNATURE BLOCK */}
            <div className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
                <h3 className="text-xs font-semibold text-slate-800">
                    Nurse signature register
                </h3>
                {canWrite && (
                    <form
                        onSubmit={addNurse}
                        className="grid gap-2 md:grid-cols-4"
                    >
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Name of nurse
                            </label>
                            <input
                                className="input h-9 text-sm"
                                value={nurseForm.name}
                                onChange={handleNurseChange('name')}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Specimen sign
                            </label>
                            <input
                                className="input h-9 text-sm"
                                value={nurseForm.specimen}
                                onChange={handleNurseChange('specimen')}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Emp. no
                            </label>
                            <input
                                className="input h-9 text-sm"
                                value={nurseForm.emp_no}
                                onChange={handleNurseChange('emp_no')}
                            />
                        </div>
                        <div className="flex items-end justify-end">
                            <button
                                type="submit"
                                className="btn w-full md:w-auto"
                                disabled={nurseSaving}
                            >
                                {nurseSaving ? 'Saving…' : 'Add nurse'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="overflow-auto rounded-xl border bg-slate-50">
                    <table className="w-full text-[11px] md:text-xs">
                        <thead>
                            <tr className="bg-slate-100 text-slate-600">
                                <th className="px-2 py-2 text-left">S. No</th>
                                <th className="px-2 py-2 text-left">Name</th>
                                <th className="px-2 py-2 text-left">Specimen sign</th>
                                <th className="px-2 py-2 text-left">Emp. no</th>
                                {canWrite && <th className="px-2 py-2" />}
                            </tr>
                        </thead>
                        <tbody>
                            {nurseRows.length ? (
                                nurseRows.map((r, idx) => (
                                    <tr key={r.id} className="border-t bg-white">
                                        <td className="px-2 py-1">{idx + 1}</td>
                                        <td className="px-2 py-1">{r.nurse_name || '—'}</td>
                                        <td className="px-2 py-1">{r.specimen_sign || '—'}</td>
                                        <td className="px-2 py-1">{r.emp_no || '—'}</td>
                                        {/* {canWrite && (
                                            <td className="px-2 py-1 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => removeNurse(r)}
                                                    className="text-[10px] text-rose-600 underline hover:text-rose-700"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        )} */}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        className="px-3 py-3 text-center text-xs text-slate-500"
                                        colSpan={canWrite ? 5 : 4}
                                    >
                                        No nurse entries recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DOCTOR DAILY AUTH */}
            <div className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
                <h3 className="text-xs font-semibold text-slate-800">
                    Doctor&apos;s daily authorisation
                </h3>
                {canWrite && (
                    <form
                        onSubmit={addAuth}
                        className="grid gap-2 md:grid-cols-4"
                    >
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Date
                            </label>
                            <input
                                type="date"
                                className="input h-9 text-sm"
                                value={authForm.date}
                                onChange={handleAuthChange('date')}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Remarks / authorisation notes
                            </label>
                            <input
                                className="input h-9 text-sm"
                                placeholder="e.g. continue same drug chart, modify doses etc."
                                value={authForm.remarks}
                                onChange={handleAuthChange('remarks')}
                            />
                        </div>
                        <div className="flex items-end justify-end">
                            <button
                                type="submit"
                                className="btn w-full md:w-auto"
                                disabled={authSaving}
                            >
                                {authSaving ? 'Saving…' : 'Add authorisation'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="overflow-auto rounded-xl border bg-slate-50">
                    <table className="w-full text-[11px] md:text-xs">
                        <thead>
                            <tr className="bg-slate-100 text-slate-600">
                                <th className="px-2 py-2 text-left">Date</th>
                                <th className="px-2 py-2 text-left">Remarks</th>
                                {/* doctor_name + sign come from backend (user table) */}
                                <th className="px-2 py-2 text-left">Doctor</th>
                                <th className="px-2 py-2 text-left">Sign</th>
                                {canWrite && <th className="px-2 py-2" />}
                            </tr>
                        </thead>
                        <tbody>
                            {authRows.length ? (
                                authRows.map((r) => (
                                    <tr key={r.id} className="border-t bg-white">
                                        <td className="px-2 py-1">
                                            {formatDate(r.auth_date)}
                                        </td>
                                        <td className="px-2 py-1">{r.remarks || '—'}</td>
                                        <td className="px-2 py-1">{r.doctor_name || '—'}</td>
                                        <td className="px-2 py-1">{r.doctor_sign || '—'}</td>
                                        {/* {canWrite && (
                                            <td className="px-2 py-1 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => removeAuth(r)}
                                                    className="text-[10px] text-rose-600 underline hover:text-rose-700"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        )} */}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        className="px-3 py-3 text-center text-xs text-slate-500"
                                        colSpan={canWrite ? 5 : 4}
                                    >
                                        No daily authorisation entries recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
export default MedicationsTab
export function extractApiErrorMessage(error, fallback = 'Something went wrong') {
    const detail = error?.response?.data?.detail

    if (!detail) return fallback

    if (typeof detail === 'string') return detail

    if (Array.isArray(detail)) {
        // pydantic-style: [{ msg, loc, type, input }, ...]
        const msgs = detail
            .map((d) => d?.msg || (typeof d === 'string' ? d : ''))
            .filter(Boolean)
        if (msgs.length) return msgs.join('; ')
    }

    if (typeof detail === 'object' && detail.msg) return detail.msg

    return fallback
}