// FILE: src/ot/tabs/AnaesthesiaTab.jsx
import { useEffect, useMemo, useState } from 'react'
import {
    getAnaesthesiaRecord,
    createAnaesthesiaRecord,
    updateAnaesthesiaRecord,
    listAnaesthesiaVitals,
    createAnaesthesiaVital,
    deleteAnaesthesiaVital,
    listAnaesthesiaDrugs,
    createAnaesthesiaDrug,
    deleteAnaesthesiaDrug,
    listOtDeviceMasters,
} from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import {
    ClipboardList,
    Activity,
    Droplet,
    Syringe,
    AlertCircle,
    CheckCircle2,
    Stethoscope,
    Search,
} from 'lucide-react'

const emptyRecord = {
    anaesthesia_type: '',
    asa_grade: '',
    airway_assessment: '',
    comorbidities: '',
    allergies: '',
    preop_pulse: '',
    preop_bp: '',
    preop_rr: '',
    preop_temp_c: '',
    preop_cvs: '',
    preop_rs: '',
    preop_cns: '',
    preop_pa: '',
    preop_veins: '',
    preop_spine: '',
    airway_teeth_status: '',
    airway_denture: '',
    airway_neck_movements: '',
    airway_mallampati_class: '',
    difficult_airway_anticipated: false,
    risk_factors: '',
    anaesthetic_plan_detail: '',
    preop_instructions: '',

    // intra-op setup
    preoxygenation: false,
    cricoid_pressure: false,
    induction_route: '',
    intubation_done: false,
    intubation_route: '',
    intubation_state: '',
    intubation_technique: '',
    tube_type: '',
    tube_size: '',
    tube_fixed_at: '',
    cuff_used: false,
    cuff_medium: '',
    bilateral_breath_sounds: '',
    added_sounds: '',
    laryngoscopy_grade: '',

    // legacy fields (kept for backward compatibility)
    airway_devices: [],
    monitors: {},
    lines: {},

    // NEW master-driven fields
    airway_device_ids: [],
    monitor_device_ids: [],

    ventilation_mode_baseline: '',
    ventilator_vt: '',
    ventilator_rate: '',
    ventilator_peep: '',
    breathing_system: '',
    tourniquet_used: false,
    patient_position: '',
    eyes_taped: false,
    eyes_covered_with_foil: false,
    pressure_points_padded: false,
    iv_fluids_plan: '',
    blood_components_plan: '',
    regional_block_type: '',
    regional_position: '',
    regional_approach: '',
    regional_space_depth: '',
    regional_needle_type: '',
    regional_drug_dose: '',
    regional_level: '',
    regional_complications: '',
    block_adequacy: '',
    sedation_needed: false,
    conversion_to_ga: false,
    notes: '',
}

const emptyVital = {
    time: '',
    hr: '',
    bp: '',
    spo2: '',
    rr: '',
    temp_c: '',
    etco2: '',
    ventilation_mode: '',
    peak_airway_pressure: '',
    cvp_pcwp: '',
    st_segment: '',
    urine_output_ml: '',
    blood_loss_ml: '',
    comments: '',
}

const emptyDrug = {
    time: '',
    drug_name: '',
    dose: '',
    route: '',
    remarks: '',
}

// -------- helpers --------
function toIntOrNull(value) {
    if (value === null || value === undefined) return null
    const trimmed = String(value).trim()
    if (!trimmed) return null
    const parsed = parseInt(trimmed, 10)
    return Number.isNaN(parsed) ? null : parsed
}

function toNumOrNull(value) {
    if (value === null || value === undefined) return null
    const trimmed = String(value).trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? null : parsed
}

function uniqIntList(arr) {
    const out = []
    const seen = new Set()
    for (const x of Array.isArray(arr) ? arr : []) {
        const n = parseInt(String(x), 10)
        if (!Number.isNaN(n) && !seen.has(n)) {
            seen.add(n)
            out.push(n)
        }
    }
    return out
}

function isValidHHMM(t) {
    if (!t) return false
    const s = String(t).trim()
    if (!/^\d{2}:\d{2}$/.test(s)) return false
    const [hh, mm] = s.split(':').map((x) => parseInt(x, 10))
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59
}

function normalizeRecord(data) {
    // backend returns null when record doesn't exist
    if (!data) {
        return {
            record: { ...emptyRecord },
            meta: { id: null, created_at: null },
            vitals: [],
            drugs: [],
        }
    }

    // always keep safe object shapes
    const monitors =
        data.monitors && typeof data.monitors === 'object' ? data.monitors : {}
    const lines = data.lines && typeof data.lines === 'object' ? data.lines : {}
    const airway_devices = Array.isArray(data.airway_devices)
        ? data.airway_devices
        : []

    // new fields (if backend already sends them)
    const airway_device_ids = uniqIntList(data.airway_device_ids)
    const monitor_device_ids = uniqIntList(data.monitor_device_ids)

    return {
        record: {
            ...emptyRecord,
            ...data,
            monitors,
            lines,
            airway_devices,
            airway_device_ids,
            monitor_device_ids,
        },
        meta: { id: data.id ?? null, created_at: data.created_at ?? null },
        vitals: [],
        drugs: [],
    }
}

/**
 * AnaesthesiaTab
 * Props:
 *  - caseId: OT case id (number)
 */
export default function AnaesthesiaTab({ caseId }) {
    // ⚠️ IMPORTANT: do NOT short-circuit hooks (no `useCan(a) || useCan(b)`).
    const p1 = useCan('ot.anaesthesia_record.view')
    const p2 = useCan('ot.anaesthesia.view')
    const p3 = useCan('ot.cases.view')
    const p4 = useCan('ipd.view')

    const e1 = useCan('ot.anaesthesia_record.update')
    const e2 = useCan('ot.anaesthesia_record.create')
    const e3 = useCan('ot.anaesthesia.update')
    const e4 = useCan('ot.anaesthesia.create')
    const e5 = useCan('ot.cases.update')
    const e6 = useCan('ipd.doctor')

    const canView = p1 || p2 || p3 || p4
    const canEdit = e1 || e2 || e3 || e4 || e5 || e6

    const [subTab, setSubTab] = useState('preop') // preop | intra | vitals | drugs

    const [record, setRecord] = useState({ ...emptyRecord })
    const [recordMeta, setRecordMeta] = useState({ id: null, created_at: null })

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const [vitals, setVitals] = useState([])
    const [newVital, setNewVital] = useState({ ...emptyVital })
    const [vitalBusy, setVitalBusy] = useState(false)

    const [drugs, setDrugs] = useState([])
    const [newDrug, setNewDrug] = useState({ ...emptyDrug })
    const [drugBusy, setDrugBusy] = useState(false)

    // device masters
    const [airwayMasters, setAirwayMasters] = useState([])
    const [monitorMasters, setMonitorMasters] = useState([])
    const [deviceLoading, setDeviceLoading] = useState(false)
    const [deviceQ, setDeviceQ] = useState('')

    // never allow null in render
    const safeRecord = record || emptyRecord

    // --------------------------------------------------
    // LOAD: record + vitals + drugs
    // --------------------------------------------------
    useEffect(() => {
        let alive = true

        const load = async () => {
            if (!canView) {
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)

            try {
                const res = await getAnaesthesiaRecord(caseId)

                // ✅ IMPORTANT: handle 200 + null
                const norm = normalizeRecord(res?.data)
                if (!alive) return

                setRecord(norm.record)
                setRecordMeta(norm.meta)

                // load vitals/drugs only if record id exists
                if (norm.meta.id) {
                    const [vRes, dRes] = await Promise.all([
                        listAnaesthesiaVitals(norm.meta.id),
                        listAnaesthesiaDrugs(norm.meta.id),
                    ])
                    if (!alive) return
                    setVitals(vRes?.data || [])
                    setDrugs(dRes?.data || [])
                } else {
                    setVitals([])
                    setDrugs([])
                }
            } catch (err) {
                const status = err?.response?.status
                if (status === 404) {
                    if (!alive) return
                    setRecord({ ...emptyRecord })
                    setRecordMeta({ id: null, created_at: null })
                    setVitals([])
                    setDrugs([])
                } else if (status === 403) {
                    if (!alive) return
                    setError('You do not have permission to view Anaesthesia records.')
                } else {
                    console.error('Anaesthesia load error', err)
                    if (!alive) return
                    setError('Unable to load anaesthesia record. Please try again.')
                }
            } finally {
                if (alive) setLoading(false)
            }
        }

        load()
        return () => {
            alive = false
        }
    }, [caseId, canView])

    // --------------------------------------------------
    // LOAD: device masters (AIRWAY + MONITOR)
    // --------------------------------------------------
    useEffect(() => {
        let alive = true
        const loadMasters = async () => {
            if (!canView) return
            setDeviceLoading(true)
            try {
                // supports both: listOtDeviceMasters(params) OR listOtDeviceMasters(category)
                const call = (params) => listOtDeviceMasters(params)

                const [aRes, mRes] = await Promise.all([
                    call({ category: 'AIRWAY', is_active: true }),
                    call({ category: 'MONITOR', is_active: true }),
                ])
                if (!alive) return
                setAirwayMasters(aRes?.data || [])
                setMonitorMasters(mRes?.data || [])
            } catch (e) {
                // not fatal: fallback to legacy static UI
                console.warn('Device masters load failed (fallback to legacy lists)', e)
                if (!alive) return
                setAirwayMasters([])
                setMonitorMasters([])
            } finally {
                if (alive) setDeviceLoading(false)
            }
        }
        loadMasters()
        return () => {
            alive = false
        }
    }, [canView])

    // --------------------------------------------------
    // PERMISSION BLOCK
    // --------------------------------------------------
    if (!canView) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                You do not have permission to view Anaesthesia records.
            </div>
        )
    }

    // --------------------------------------------------
    // BANNER
    // --------------------------------------------------
    const showBanner = useMemo(
        () =>
            error ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            ) : success ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{success}</span>
                </div>
            ) : null,
        [error, success],
    )

    // --------------------------------------------------
    // HELPERS
    // --------------------------------------------------
    const handleField = (name, value) => {
        setRecord((prev) => ({ ...(prev || emptyRecord), [name]: value }))
    }

    const toggleBool = (name) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            return { ...base, [name]: !base[name] }
        })
    }

    // legacy toggles (monitors object)
    const toggleLegacyMonitor = (key) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            const m =
                base.monitors && typeof base.monitors === 'object' ? base.monitors : {}
            return { ...base, monitors: { ...m, [key]: !m[key] } }
        })
    }

    const toggleLine = (key) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            const l = base.lines && typeof base.lines === 'object' ? base.lines : {}
            return { ...base, lines: { ...l, [key]: !l[key] } }
        })
    }

    // legacy airway device strings
    const toggleLegacyAirwayDevice = (value) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            const arr = Array.isArray(base.airway_devices) ? base.airway_devices : []
            if (arr.includes(value)) {
                return { ...base, airway_devices: arr.filter((v) => v !== value) }
            }
            return { ...base, airway_devices: [...arr, value] }
        })
    }

    // master-driven device IDs
    const toggleDeviceId = (field, id) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            const arr = uniqIntList(base[field])
            if (arr.includes(id)) {
                return { ...base, [field]: arr.filter((x) => x !== id) }
            }
            return { ...base, [field]: [...arr, id] }
        })
    }

    const selectedAirwayIds = uniqIntList(safeRecord.airway_device_ids)
    const selectedMonitorIds = uniqIntList(safeRecord.monitor_device_ids)

    const filteredAirwayMasters = useMemo(() => {
        const q = deviceQ.trim().toLowerCase()
        const src = airwayMasters || []
        if (!q) return src
        return src.filter(
            (d) =>
                String(d.name || '').toLowerCase().includes(q) ||
                String(d.code || '').toLowerCase().includes(q),
        )
    }, [airwayMasters, deviceQ])

    const filteredMonitorMasters = useMemo(() => {
        const q = deviceQ.trim().toLowerCase()
        const src = monitorMasters || []
        if (!q) return src
        return src.filter(
            (d) =>
                String(d.name || '').toLowerCase().includes(q) ||
                String(d.code || '').toLowerCase().includes(q),
        )
    }, [monitorMasters, deviceQ])

    // --------------------------------------------------
    // SAVE PRE-OP + INTRA-OP
    // --------------------------------------------------
    const handleSaveRecord = async () => {
        if (!canEdit) {
            setError('You do not have permission to edit anaesthesia records.')
            return
        }

        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            const payload = {
                ...(safeRecord || emptyRecord),

                // normalize numeric strings
                ventilator_vt: toIntOrNull(safeRecord.ventilator_vt),
                ventilator_rate: toIntOrNull(safeRecord.ventilator_rate),
                ventilator_peep: toIntOrNull(safeRecord.ventilator_peep),

                // ensure lists are int[]
                airway_device_ids: uniqIntList(safeRecord.airway_device_ids),
                monitor_device_ids: uniqIntList(safeRecord.monitor_device_ids),

                // keep legacy fields safe
                airway_devices: Array.isArray(safeRecord.airway_devices)
                    ? safeRecord.airway_devices
                    : [],
                monitors:
                    safeRecord.monitors && typeof safeRecord.monitors === 'object'
                        ? safeRecord.monitors
                        : {},
                lines:
                    safeRecord.lines && typeof safeRecord.lines === 'object'
                        ? safeRecord.lines
                        : {},
            }

            if (recordMeta.id) {
                await updateAnaesthesiaRecord(caseId, payload)
            } else {
                const res = await createAnaesthesiaRecord(caseId, payload)
                const created = normalizeRecord(res?.data)
                setRecord(created.record)
                setRecordMeta(created.meta)
            }

            setSuccess('Anaesthesia record saved.')
        } catch (err) {
            console.error('Save anaesthesia record error', err)
            setError('Unable to save anaesthesia record.')
        } finally {
            setSaving(false)
        }
    }

    // --------------------------------------------------
    // VITALS
    // --------------------------------------------------
    const handleAddVital = async () => {
        if (!canEdit) {
            setError('You do not have permission to add vitals.')
            return
        }
        if (!recordMeta.id) {
            setError('Save the anaesthesia record before adding vitals.')
            return
        }
        if (!isValidHHMM(newVital.time)) {
            setError('Time is required for vitals in HH:MM format.')
            return
        }

        setVitalBusy(true)
        setError(null)
        setSuccess(null)

        try {
            const payload = {
                ...newVital,
                hr: toNumOrNull(newVital.hr),
                spo2: toNumOrNull(newVital.spo2),
                rr: toNumOrNull(newVital.rr),
                temp_c: toNumOrNull(newVital.temp_c),
                etco2: toNumOrNull(newVital.etco2),
                peak_airway_pressure: toNumOrNull(newVital.peak_airway_pressure),
                cvp_pcwp: toNumOrNull(newVital.cvp_pcwp),
                urine_output_ml: toNumOrNull(newVital.urine_output_ml),
                blood_loss_ml: toNumOrNull(newVital.blood_loss_ml),

                // if UI used one field, backend expects comments; keep both safe
                comments: newVital.comments || newVital.st_segment || '',
                st_segment: newVital.st_segment || '',
            }

            const res = await createAnaesthesiaVital(recordMeta.id, payload)
            setVitals((prev) => [...prev, res.data])
            setNewVital({ ...emptyVital })
            setSuccess('Vitals entry added.')
        } catch (err) {
            console.error('Add vital error', err)
            setError('Unable to add vitals entry.')
        } finally {
            setVitalBusy(false)
        }
    }

    const handleDeleteVital = async (id) => {
        if (!canEdit) {
            setError('You do not have permission to delete vitals.')
            return
        }
        if (!window.confirm('Delete this vitals entry?')) return

        setVitalBusy(true)
        setError(null)
        setSuccess(null)

        try {
            await deleteAnaesthesiaVital(id)
            setVitals((prev) => prev.filter((v) => v.id !== id))
            setSuccess('Vitals entry deleted.')
        } catch (err) {
            console.error('Delete vital error', err)
            setError('Unable to delete vitals entry.')
        } finally {
            setVitalBusy(false)
        }
    }

    // --------------------------------------------------
    // DRUGS
    // --------------------------------------------------
    const handleAddDrug = async () => {
        if (!canEdit) {
            setError('You do not have permission to add drug log entries.')
            return
        }
        if (!recordMeta.id) {
            setError('Save the anaesthesia record before adding drug log.')
            return
        }
        if (!isValidHHMM(newDrug.time) || !String(newDrug.drug_name || '').trim()) {
            setError('Drug time (HH:MM) and name are required.')
            return
        }

        setDrugBusy(true)
        setError(null)
        setSuccess(null)

        try {
            const res = await createAnaesthesiaDrug(recordMeta.id, {
                ...newDrug,
                drug_name: String(newDrug.drug_name || '').trim(),
            })
            setDrugs((prev) => [...prev, res.data])
            setNewDrug({ ...emptyDrug })
            setSuccess('Drug log entry added.')
        } catch (err) {
            console.error('Add drug error', err)
            setError('Unable to add drug log entry.')
        } finally {
            setDrugBusy(false)
        }
    }

    const handleDeleteDrug = async (id) => {
        if (!canEdit) {
            setError('You do not have permission to delete drug log entries.')
            return
        }
        if (!window.confirm('Delete this drug entry?')) return

        setDrugBusy(true)
        setError(null)
        setSuccess(null)

        try {
            await deleteAnaesthesiaDrug(id)
            setDrugs((prev) => prev.filter((d) => d.id !== id))
            setSuccess('Drug log entry deleted.')
        } catch (err) {
            console.error('Delete drug error', err)
            setError('Unable to delete drug entry.')
        } finally {
            setDrugBusy(false)
        }
    }

    // --------------------------------------------------
    // RENDER HELPERS – SUB-TABS
    // --------------------------------------------------
    const renderPreop = () => (
        <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ClipboardList className="h-4 w-4" />
                    Pre-anaesthetic assessment
                </h3>

                <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
                    <TextInput
                        label="ASA Grade"
                        value={safeRecord.asa_grade}
                        onChange={(v) => handleField('asa_grade', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Anaesthesia type"
                        value={safeRecord.anaesthesia_type}
                        onChange={(v) => handleField('anaesthesia_type', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Co-morbidities"
                        value={safeRecord.comorbidities}
                        onChange={(v) => handleField('comorbidities', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Allergies"
                        value={safeRecord.allergies}
                        onChange={(v) => handleField('allergies', v)}
                        disabled={!canEdit}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
                    <TextInput
                        label="Pulse"
                        value={safeRecord.preop_pulse}
                        onChange={(v) => handleField('preop_pulse', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="BP"
                        value={safeRecord.preop_bp}
                        onChange={(v) => handleField('preop_bp', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="RR"
                        value={safeRecord.preop_rr}
                        onChange={(v) => handleField('preop_rr', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Temp (°C)"
                        value={safeRecord.preop_temp_c}
                        onChange={(v) => handleField('preop_temp_c', v)}
                        disabled={!canEdit}
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
                    <TextInput
                        label="CVS"
                        value={safeRecord.preop_cvs}
                        onChange={(v) => handleField('preop_cvs', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="RS"
                        value={safeRecord.preop_rs}
                        onChange={(v) => handleField('preop_rs', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="CNS"
                        value={safeRecord.preop_cns}
                        onChange={(v) => handleField('preop_cns', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="PA"
                        value={safeRecord.preop_pa}
                        onChange={(v) => handleField('preop_pa', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Veins"
                        value={safeRecord.preop_veins}
                        onChange={(v) => handleField('preop_veins', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Spine"
                        value={safeRecord.preop_spine}
                        onChange={(v) => handleField('preop_spine', v)}
                        disabled={!canEdit}
                    />
                </div>
            </div>

            <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Activity className="h-4 w-4" />
                    Airway & risk
                </h3>

                <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
                    <TextInput
                        label="Teeth"
                        placeholder="Intact / Loose"
                        value={safeRecord.airway_teeth_status}
                        onChange={(v) => handleField('airway_teeth_status', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Denture"
                        placeholder="Present / Absent"
                        value={safeRecord.airway_denture}
                        onChange={(v) => handleField('airway_denture', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Neck movements"
                        value={safeRecord.airway_neck_movements}
                        onChange={(v) => handleField('airway_neck_movements', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Mallampati class"
                        placeholder="Class 1 / 2 / 3 / 4"
                        value={safeRecord.airway_mallampati_class}
                        onChange={(v) => handleField('airway_mallampati_class', v)}
                        disabled={!canEdit}
                    />
                </div>

                <div className="flex items-center gap-2 text-[12px]">
                    <Checkbox
                        label="Difficult airway anticipated"
                        checked={safeRecord.difficult_airway_anticipated || false}
                        onChange={() => toggleBool('difficult_airway_anticipated')}
                        disabled={!canEdit}
                    />
                </div>

                <Textarea
                    label="Risk factors"
                    value={safeRecord.risk_factors}
                    onChange={(v) => handleField('risk_factors', v)}
                    disabled={!canEdit}
                />
                <Textarea
                    label="Anaesthetic plan"
                    value={safeRecord.anaesthetic_plan_detail}
                    onChange={(v) => handleField('anaesthetic_plan_detail', v)}
                    disabled={!canEdit}
                />
                <Textarea
                    label="Pre-op instructions"
                    value={safeRecord.preop_instructions}
                    onChange={(v) => handleField('preop_instructions', v)}
                    disabled={!canEdit}
                />
            </div>
        </div>
    )

    const renderIntraOp = () => (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Induction & intubation */}
                <div className="space-y-3 rounded-2xl border bg-white p-4 text-[12px] shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Stethoscope className="h-4 w-4" />
                        Induction & intubation
                    </h3>

                    <div className="flex flex-wrap gap-3">
                        <Checkbox
                            label="Preoxygenation"
                            checked={!!safeRecord.preoxygenation}
                            onChange={() => toggleBool('preoxygenation')}
                            disabled={!canEdit}
                        />
                        <Checkbox
                            label="Cricoid pressure"
                            checked={!!safeRecord.cricoid_pressure}
                            onChange={() => toggleBool('cricoid_pressure')}
                            disabled={!canEdit}
                        />
                    </div>

                    <Select
                        label="Induction"
                        value={safeRecord.induction_route}
                        onChange={(v) => handleField('induction_route', v)}
                        options={['', 'Intravenous', 'Inhalational', 'Rapid sequence']}
                        disabled={!canEdit}
                    />

                    <Checkbox
                        label="Intubation done"
                        checked={!!safeRecord.intubation_done}
                        onChange={() => toggleBool('intubation_done')}
                        disabled={!canEdit}
                    />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                            label="Route"
                            value={safeRecord.intubation_route}
                            onChange={(v) => handleField('intubation_route', v)}
                            options={['', 'Oral', 'Nasal']}
                            disabled={!canEdit}
                        />
                        <Select
                            label="State"
                            value={safeRecord.intubation_state}
                            onChange={(v) => handleField('intubation_state', v)}
                            options={['', 'Awake', 'Anaesthetised']}
                            disabled={!canEdit}
                        />
                        <Select
                            label="Technique"
                            value={safeRecord.intubation_technique}
                            onChange={(v) => handleField('intubation_technique', v)}
                            options={['', 'Visual', 'Blind', 'Fibreoptic', 'Retrograde']}
                            disabled={!canEdit}
                        />
                        <TextInput
                            label="Laryngoscopy grade"
                            placeholder="I / II / III / IV"
                            value={safeRecord.laryngoscopy_grade}
                            onChange={(v) => handleField('laryngoscopy_grade', v)}
                            disabled={!canEdit}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextInput
                            label="Tube type"
                            value={safeRecord.tube_type}
                            onChange={(v) => handleField('tube_type', v)}
                            disabled={!canEdit}
                        />
                        <TextInput
                            label="Size"
                            value={safeRecord.tube_size}
                            onChange={(v) => handleField('tube_size', v)}
                            disabled={!canEdit}
                        />
                        <TextInput
                            label="Fixed at"
                            value={safeRecord.tube_fixed_at}
                            onChange={(v) => handleField('tube_fixed_at', v)}
                            disabled={!canEdit}
                        />
                        <Select
                            label="Cuff medium"
                            value={safeRecord.cuff_medium}
                            onChange={(v) => handleField('cuff_medium', v)}
                            options={['', 'Air', 'Saline', 'Not inflated']}
                            disabled={!canEdit}
                        />
                    </div>

                    <Checkbox
                        label="Cuff used"
                        checked={!!safeRecord.cuff_used}
                        onChange={() => toggleBool('cuff_used')}
                        disabled={!canEdit}
                    />

                    <TextInput
                        label="Bilateral breath sounds"
                        value={safeRecord.bilateral_breath_sounds}
                        onChange={(v) => handleField('bilateral_breath_sounds', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Added sounds"
                        value={safeRecord.added_sounds}
                        onChange={(v) => handleField('added_sounds', v)}
                        disabled={!canEdit}
                    />
                </div>

                {/* Devices & monitors (MASTER) + fallback legacy */}
                <div className="space-y-3 rounded-2xl border bg-white p-4 text-[12px] shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">Devices & monitors</h3>

                        <div className="relative w-[220px] max-w-full">
                            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                className="h-9 w-full rounded-md border border-slate-300 bg-slate-50 pl-8 pr-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                                placeholder="Search devices..."
                                value={deviceQ}
                                onChange={(e) => setDeviceQ(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* MASTER AIRWAY */}
                    <div className="rounded-xl border bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-[11px] font-semibold text-slate-700">Airway devices (Master)</div>
                            <div className="text-[11px] text-slate-500">
                                {deviceLoading ? 'Loading…' : `${selectedAirwayIds.length} selected`}
                            </div>
                        </div>

                        {filteredAirwayMasters.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {filteredAirwayMasters.map((d) => (
                                    <Checkbox
                                        key={d.id}
                                        label={d.name}
                                        checked={selectedAirwayIds.includes(d.id)}
                                        onChange={() => toggleDeviceId('airway_device_ids', d.id)}
                                        disabled={!canEdit}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-[11px] text-slate-600">
                                No master airway devices found. (Fallback below)
                            </div>
                        )}
                    </div>

                    {/* MASTER MONITORS */}
                    <div className="rounded-xl border bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-[11px] font-semibold text-slate-700">Monitors (Master)</div>
                            <div className="text-[11px] text-slate-500">
                                {deviceLoading ? 'Loading…' : `${selectedMonitorIds.length} selected`}
                            </div>
                        </div>

                        {filteredMonitorMasters.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {filteredMonitorMasters.map((d) => (
                                    <Checkbox
                                        key={d.id}
                                        label={d.name}
                                        checked={selectedMonitorIds.includes(d.id)}
                                        onChange={() => toggleDeviceId('monitor_device_ids', d.id)}
                                        disabled={!canEdit}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-[11px] text-slate-600">
                                No master monitor devices found. (Fallback below)
                            </div>
                        )}
                    </div>

                    {/* LEGACY FALLBACK (only when masters empty)
                    {(airwayMasters.length === 0 || monitorMasters.length === 0) && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="text-[11px] font-semibold text-slate-700">Legacy (optional)</div>

                            <div className="mt-2 text-[11px] font-semibold text-slate-600">Airway devices</div>
                            <div className="mt-1 grid grid-cols-2 gap-1">
                                {['Face mask', 'LMA/ILMA', 'Oral airway', 'Throat pack', 'NG tube', 'Other'].map(
                                    (label) => (
                                        <Checkbox
                                            key={label}
                                            label={label}
                                            checked={(safeRecord.airway_devices || []).includes(label)}
                                            onChange={() => toggleLegacyAirwayDevice(label)}
                                            disabled={!canEdit}
                                        />
                                    ),
                                )}
                            </div>

                            <div className="mt-3 text-[11px] font-semibold text-slate-600">Monitors</div>
                            <div className="mt-1 grid grid-cols-2 gap-1">
                                {[
                                    ['ecg', 'ECG'],
                                    ['nibp', 'NIBP'],
                                    ['pulse_oximeter', 'Pulse oximeter'],
                                    ['capnograph', 'Capnograph'],
                                    ['agent_monitor', 'Agent monitor'],
                                    ['pns', 'PNS'],
                                    ['temperature', 'Temperature'],
                                    ['urinary_catheter', 'Urinary catheter'],
                                    ['ibp', 'IBP'],
                                    ['cvp', 'CVP'],
                                    ['precordial_steth', 'Precordial steth'],
                                    ['oesophageal_steth', 'Oesophageal steth'],
                                ].map(([key, label]) => (
                                    <Checkbox
                                        key={key}
                                        label={label}
                                        checked={!!safeRecord.monitors?.[key]}
                                        onChange={() => toggleLegacyMonitor(key)}
                                        disabled={!canEdit}
                                    />
                                ))}
                            </div>
                        </div>
                    )} */}
                </div>

                {/* Ventilation, position, fluids, block */}
                <div className="space-y-3 rounded-2xl border bg-white p-4 text-[12px] shadow-sm">
                    <h3 className="mb-1 text-sm font-semibold text-slate-900">
                        Ventilation & block
                    </h3>

                    <Select
                        label="Ventilation mode"
                        value={safeRecord.ventilation_mode_baseline}
                        onChange={(v) => handleField('ventilation_mode_baseline', v)}
                        options={['', 'Spontaneous', 'Controlled', 'Manual', 'Ventilator']}
                        disabled={!canEdit}
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <TextInput
                            label="Vt (ml)"
                            value={safeRecord.ventilator_vt}
                            onChange={(v) => handleField('ventilator_vt', v)}
                            disabled={!canEdit}
                        />
                        <TextInput
                            label="Rate (f)"
                            value={safeRecord.ventilator_rate}
                            onChange={(v) => handleField('ventilator_rate', v)}
                            disabled={!canEdit}
                        />
                        <TextInput
                            label="PEEP (cmH₂O)"
                            value={safeRecord.ventilator_peep}
                            onChange={(v) => handleField('ventilator_peep', v)}
                            disabled={!canEdit}
                        />
                    </div>

                    <Select
                        label="Breathing system"
                        value={safeRecord.breathing_system}
                        onChange={(v) => handleField('breathing_system', v)}
                        options={['', 'Mapleson A', 'Mapleson D', 'Mapleson F', 'Circle system', 'Other']}
                        disabled={!canEdit}
                    />

                    <div className="mt-2 text-[11px] font-semibold text-slate-600">
                        Position & protection
                    </div>
                    <Select
                        label="Patient position"
                        value={safeRecord.patient_position}
                        onChange={(v) => handleField('patient_position', v)}
                        options={['', 'Supine', 'Lateral', 'Prone', 'Lithotomy', 'Other']}
                        disabled={!canEdit}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Checkbox
                            label="Eyes taped"
                            checked={!!safeRecord.eyes_taped}
                            onChange={() => toggleBool('eyes_taped')}
                            disabled={!canEdit}
                        />
                        <Checkbox
                            label="Eyes covered with foil"
                            checked={!!safeRecord.eyes_covered_with_foil}
                            onChange={() => toggleBool('eyes_covered_with_foil')}
                            disabled={!canEdit}
                        />
                        <Checkbox
                            label="Pressure points padded"
                            checked={!!safeRecord.pressure_points_padded}
                            onChange={() => toggleBool('pressure_points_padded')}
                            disabled={!canEdit}
                        />
                    </div>

                    <div className="mt-2 text-[11px] font-semibold text-slate-600">
                        Lines & tourniquet
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {[
                            ['peripheral_iv', 'Peripheral IV'],
                            ['central_line', 'Central line'],
                            ['arterial_line', 'Arterial line'],
                        ].map(([key, label]) => (
                            <Checkbox
                                key={key}
                                label={label}
                                checked={!!safeRecord.lines?.[key]}
                                onChange={() => toggleLine(key)}
                                disabled={!canEdit}
                            />
                        ))}
                    </div>
                    <Checkbox
                        label="Tourniquet used"
                        checked={!!safeRecord.tourniquet_used}
                        onChange={() => toggleBool('tourniquet_used')}
                        disabled={!canEdit}
                    />

                    <TextInput
                        label="IV fluids plan"
                        value={safeRecord.iv_fluids_plan}
                        onChange={(v) => handleField('iv_fluids_plan', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Blood & components plan"
                        value={safeRecord.blood_components_plan}
                        onChange={(v) => handleField('blood_components_plan', v)}
                        disabled={!canEdit}
                    />

                    <div className="mt-2 text-[11px] font-semibold text-slate-600">
                        Regional block
                    </div>
                    <Select
                        label="Type"
                        value={safeRecord.regional_block_type}
                        onChange={(v) => handleField('regional_block_type', v)}
                        options={['', 'Spinal', 'Epidural', 'Nerve block', 'Combined', 'None']}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Position"
                        value={safeRecord.regional_position}
                        onChange={(v) => handleField('regional_position', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Approach"
                        value={safeRecord.regional_approach}
                        onChange={(v) => handleField('regional_approach', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Space & depth"
                        value={safeRecord.regional_space_depth}
                        onChange={(v) => handleField('regional_space_depth', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Needle type"
                        value={safeRecord.regional_needle_type}
                        onChange={(v) => handleField('regional_needle_type', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Drug injected / dose"
                        value={safeRecord.regional_drug_dose}
                        onChange={(v) => handleField('regional_drug_dose', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Level of anaesthesia"
                        value={safeRecord.regional_level}
                        onChange={(v) => handleField('regional_level', v)}
                        disabled={!canEdit}
                    />
                    <TextInput
                        label="Complications"
                        value={safeRecord.regional_complications}
                        onChange={(v) => handleField('regional_complications', v)}
                        disabled={!canEdit}
                    />

                    <Select
                        label="Adequacy of block"
                        value={safeRecord.block_adequacy}
                        onChange={(v) => handleField('block_adequacy', v)}
                        options={['', 'Excellent', 'Adequate', 'Poor']}
                        disabled={!canEdit}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Checkbox
                            label="Sedation needed"
                            checked={!!safeRecord.sedation_needed}
                            onChange={() => toggleBool('sedation_needed')}
                            disabled={!canEdit}
                        />
                        <Checkbox
                            label="Conversion to GA"
                            checked={!!safeRecord.conversion_to_ga}
                            onChange={() => toggleBool('conversion_to_ga')}
                            disabled={!canEdit}
                        />
                    </div>
                </div>
            </div>

            <Textarea
                label="Intra-op summary / notes"
                value={safeRecord.notes || ''}
                onChange={(v) => handleField('notes', v)}
                disabled={!canEdit}
            />
        </div>
    )

    const renderVitals = () => (
        <div className="space-y-3 rounded-2xl border bg-white p-4 text-[12px] shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Activity className="h-4 w-4" />
                Intra-op vitals log
            </h3>

            {!recordMeta.id && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
                    Save the anaesthesia record first to enable vitals logging.
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <TextInput
                    label="Time (HH:MM)"
                    value={newVital.time}
                    onChange={(v) => setNewVital((p) => ({ ...p, time: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="HR"
                    value={newVital.hr}
                    onChange={(v) => setNewVital((p) => ({ ...p, hr: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="BP"
                    value={newVital.bp}
                    onChange={(v) => setNewVital((p) => ({ ...p, bp: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="SpO₂"
                    value={newVital.spo2}
                    onChange={(v) => setNewVital((p) => ({ ...p, spo2: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="RR"
                    value={newVital.rr}
                    onChange={(v) => setNewVital((p) => ({ ...p, rr: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="Temp °C"
                    value={newVital.temp_c}
                    onChange={(v) => setNewVital((p) => ({ ...p, temp_c: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <TextInput
                    label="ETCO₂"
                    value={newVital.etco2}
                    onChange={(v) => setNewVital((p) => ({ ...p, etco2: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="Vent mode"
                    value={newVital.ventilation_mode}
                    onChange={(v) =>
                        setNewVital((p) => ({ ...p, ventilation_mode: v }))
                    }
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="Peak P (cmH₂O)"
                    value={newVital.peak_airway_pressure}
                    onChange={(v) =>
                        setNewVital((p) => ({ ...p, peak_airway_pressure: v }))
                    }
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="CVP / PCWP"
                    value={newVital.cvp_pcwp}
                    onChange={(v) => setNewVital((p) => ({ ...p, cvp_pcwp: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="Urine (ml)"
                    value={newVital.urine_output_ml}
                    onChange={(v) =>
                        setNewVital((p) => ({ ...p, urine_output_ml: v }))
                    }
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="Blood loss (ml)"
                    value={newVital.blood_loss_ml}
                    onChange={(v) =>
                        setNewVital((p) => ({ ...p, blood_loss_ml: v }))
                    }
                    disabled={!canEdit || !recordMeta.id}
                />
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <div className="flex-1">
                    <TextInput
                        label="Comments"
                        value={newVital.comments}
                        onChange={(v) => setNewVital((p) => ({ ...p, comments: v }))}
                        disabled={!canEdit || !recordMeta.id}
                    />
                </div>
                {canEdit && (
                    <button
                        type="button"
                        onClick={handleAddVital}
                        disabled={vitalBusy || !recordMeta.id}
                        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {vitalBusy ? 'Adding…' : 'Add vitals'}
                    </button>
                )}
            </div>

            <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-[11px]">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <Th>Time</Th>
                            <Th>HR</Th>
                            <Th>BP</Th>
                            <Th>SpO₂</Th>
                            <Th>RR</Th>
                            <Th>Temp</Th>
                            <Th>ETCO₂</Th>
                            <Th>Vent</Th>
                            <Th>Peak P</Th>
                            <Th>CVP/PCWP</Th>
                            <Th>Urine</Th>
                            <Th>Blood loss</Th>
                            <Th>Comments</Th>
                            <Th></Th>
                        </tr>
                    </thead>
                    <tbody>
                        {vitals.length === 0 ? (
                            <tr>
                                <td colSpan={14} className="py-3 text-center text-slate-500">
                                    No vitals logged yet.
                                </td>
                            </tr>
                        ) : (
                            vitals.map((v) => (
                                <tr key={v.id} className="border-t">
                                    <Td>{v.time}</Td>
                                    <Td>{v.hr}</Td>
                                    <Td>{v.bp}</Td>
                                    <Td>{v.spo2}</Td>
                                    <Td>{v.rr}</Td>
                                    <Td>{v.temp_c}</Td>
                                    <Td>{v.etco2}</Td>
                                    <Td>{v.ventilation_mode}</Td>
                                    <Td>{v.peak_airway_pressure}</Td>
                                    <Td>{v.cvp_pcwp}</Td>
                                    <Td>{v.urine_output_ml}</Td>
                                    <Td>{v.blood_loss_ml}</Td>
                                    <Td>{v.comments}</Td>
                                    <Td>
                                        {canEdit && (
                                            <button
                                                onClick={() => handleDeleteVital(v.id)}
                                                className="text-xs font-semibold text-red-500 hover:underline"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </Td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )

    const renderDrugs = () => (
        <div className="space-y-3 rounded-2xl border bg-white p-4 text-[12px] shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Syringe className="h-4 w-4" />
                Anaesthesia drug log
            </h3>

            {!recordMeta.id && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
                    Save the anaesthesia record first to enable drug logging.
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <TextInput
                    label="Time (HH:MM)"
                    value={newDrug.time}
                    onChange={(v) => setNewDrug((p) => ({ ...p, time: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="Drug name"
                    value={newDrug.drug_name}
                    onChange={(v) => setNewDrug((p) => ({ ...p, drug_name: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="Dose"
                    value={newDrug.dose}
                    onChange={(v) => setNewDrug((p) => ({ ...p, dose: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="Route"
                    value={newDrug.route}
                    onChange={(v) => setNewDrug((p) => ({ ...p, route: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
                <TextInput
                    label="Remarks"
                    value={newDrug.remarks}
                    onChange={(v) => setNewDrug((p) => ({ ...p, remarks: v }))}
                    disabled={!canEdit || !recordMeta.id}
                />
            </div>

            {canEdit && (
                <button
                    type="button"
                    onClick={handleAddDrug}
                    disabled={drugBusy || !recordMeta.id}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {drugBusy ? 'Adding…' : 'Add drug'}
                </button>
            )}

            <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-[11px]">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <Th>Time</Th>
                            <Th>Drug</Th>
                            <Th>Dose</Th>
                            <Th>Route</Th>
                            <Th>Remarks</Th>
                            <Th></Th>
                        </tr>
                    </thead>
                    <tbody>
                        {drugs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-3 text-center text-slate-500">
                                    No drugs logged yet.
                                </td>
                            </tr>
                        ) : (
                            drugs.map((d) => (
                                <tr key={d.id} className="border-t">
                                    <Td>{d.time}</Td>
                                    <Td>{d.drug_name}</Td>
                                    <Td>{d.dose}</Td>
                                    <Td>{d.route}</Td>
                                    <Td>{d.remarks}</Td>
                                    <Td>
                                        {canEdit && (
                                            <button
                                                onClick={() => handleDeleteDrug(d.id)}
                                                className="text-xs font-semibold text-red-500 hover:underline"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </Td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )

    if (loading) {
        return (
            <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
                Loading anaesthesia record…
            </div>
        )
    }

    return (
        <div className="space-y-4 text-[13px]">
            {showBanner}

            <div className="flex flex-wrap items-center gap-2 rounded-full bg-slate-100 p-1 text-[12px]">
                <div className="flex flex-1 flex-wrap gap-1 overflow-x-auto">
                    <SubTabButton
                        active={subTab === 'preop'}
                        onClick={() => setSubTab('preop')}
                        icon={ClipboardList}
                    >
                        Pre-op record
                    </SubTabButton>
                    <SubTabButton
                        active={subTab === 'intra'}
                        onClick={() => setSubTab('intra')}
                        icon={Droplet}
                    >
                        Intra-op setup
                    </SubTabButton>
                    <SubTabButton
                        active={subTab === 'vitals'}
                        onClick={() => setSubTab('vitals')}
                        icon={Activity}
                    >
                        Vitals log
                    </SubTabButton>
                    <SubTabButton
                        active={subTab === 'drugs'}
                        onClick={() => setSubTab('drugs')}
                        icon={Syringe}
                    >
                        Drug log
                    </SubTabButton>
                </div>

                <div className="ml-auto flex items-center text-[11px] font-medium text-slate-500">
                    {recordMeta.id ? 'Record created' : 'No record yet'}
                </div>
            </div>

            {subTab === 'preop' && renderPreop()}
            {subTab === 'intra' && renderIntraOp()}
            {subTab === 'vitals' && renderVitals()}
            {subTab === 'drugs' && renderDrugs()}

            {canEdit && (
                <div className="sticky bottom-0 mt-4 flex justify-end border-t bg-slate-50/90 px-2 py-3 backdrop-blur">
                    <button
                        type="button"
                        onClick={handleSaveRecord}
                        disabled={saving}
                        className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-[13px] font-semibold text-white shadow-md hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? 'Saving…' : 'Save anaesthesia record'}
                    </button>
                </div>
            )}
        </div>
    )
}

/* ---------- small reusable components ---------- */

function SubTabButton({ active, onClick, children, icon: Icon }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ' +
                (active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:bg-white/70')
            }
        >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{children}</span>
        </button>
    )
}

function TextInput({ label, value, onChange, placeholder, disabled = false }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
            <input
                className="h-9 rounded-md border border-slate-300 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
        </label>
    )
}

function Textarea({ label, value, onChange, placeholder, disabled = false }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
            <textarea
                className="min-h-[70px] rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
        </label>
    )
}

function Checkbox({ label, checked, onChange, disabled = false }) {
    return (
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-700">
            <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                checked={!!checked}
                onChange={onChange}
                disabled={disabled}
            />
            <span className="leading-tight">{label}</span>
        </label>
    )
}

function Select({ label, value, onChange, options, disabled = false }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
            <select
                className="h-9 rounded-md border border-slate-300 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            >
                {options.map((opt) => (
                    <option key={opt || 'empty'} value={opt}>
                        {opt || '—'}
                    </option>
                ))}
            </select>
        </label>
    )
}

function Th({ children }) {
    return (
        <th className="px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            {children}
        </th>
    )
}

function Td({ children }) {
    return <td className="px-2 py-1 align-top text-[11px] text-slate-700">{children}</td>
}
