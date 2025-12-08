// FILE: src/ot/tabs/AnaesthesiaTab.jsx
import { useEffect, useState, useMemo } from 'react'
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
} from '../../api/ot'
import {
    ClipboardList,
    Activity,
    Droplet,
    Syringe,
    AlertCircle,
    CheckCircle2,
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
    airway_devices: [],
    ventilation_mode_baseline: '',
    ventilator_vt: '',
    ventilator_rate: '',
    ventilator_peep: '',
    breathing_system: '',
    monitors: {},
    lines: {},
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

/**
 * AnaesthesiaTab
 * Props:
 *  - caseId: OT case id (number)
 */
export default function AnaesthesiaTab({ caseId }) {
    const [subTab, setSubTab] = useState('preop') // preop | intra | vitals | drugs
    const [record, setRecord] = useState(emptyRecord)
    const [recordMeta, setRecordMeta] = useState({ id: null, created_at: null })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const [vitals, setVitals] = useState([])
    const [newVital, setNewVital] = useState(emptyVital)
    const [vitalBusy, setVitalBusy] = useState(false)

    const [drugs, setDrugs] = useState([])
    const [newDrug, setNewDrug] = useState(emptyDrug)
    const [drugBusy, setDrugBusy] = useState(false)

    // --------------------------------------------------
    // LOAD
    // --------------------------------------------------
    useEffect(() => {
        let alive = true

        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await getAnaesthesiaRecord(caseId)
                const data = res.data
                if (!alive) return

                setRecord((prev) => ({
                    ...prev,
                    ...data,
                    monitors: data.monitors || {},
                    lines: data.lines || {},
                    airway_devices: data.airway_devices || [],
                }))
                setRecordMeta({ id: data.id, created_at: data.created_at })

                if (data.id) {
                    const [vRes, dRes] = await Promise.all([
                        listAnaesthesiaVitals(data.id),
                        listAnaesthesiaDrugs(data.id),
                    ])
                    if (!alive) return
                    setVitals(vRes.data || [])
                    setDrugs(dRes.data || [])
                }
            } catch (err) {
                if (err?.response?.status === 404) {
                    setRecord(emptyRecord)
                    setRecordMeta({ id: null, created_at: null })
                    setVitals([])
                    setDrugs([])
                } else {
                    console.error('Anaesthesia load error', err)
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
    }, [caseId])

    // --------------------------------------------------
    // HELPERS
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

    const handleField = (name, value) => {
        setRecord((prev) => ({ ...prev, [name]: value }))
    }

    const toggleBool = (name) => {
        setRecord((prev) => ({ ...prev, [name]: !prev[name] }))
    }

    const toggleMonitor = (key) => {
        setRecord((prev) => ({
            ...prev,
            monitors: { ...(prev.monitors || {}), [key]: !prev.monitors?.[key] },
        }))
    }

    const toggleLine = (key) => {
        setRecord((prev) => ({
            ...prev,
            lines: { ...(prev.lines || {}), [key]: !prev.lines?.[key] },
        }))
    }

    const toggleDevice = (value) => {
        setRecord((prev) => {
            const arr = prev.airway_devices || []
            if (arr.includes(value)) {
                return { ...prev, airway_devices: arr.filter((v) => v !== value) }
            }
            return { ...prev, airway_devices: [...arr, value] }
        })
    }

    // --------------------------------------------------
    // SAVE PRE-OP + INTRA-OP (same payload)
    // --------------------------------------------------

    const handleSaveRecord = async () => {
        setSaving(true)
        setError(null)
        setSuccess(null)
        try {
            const payload = {
                ...record,
                ventilator_vt: toIntOrNull(record.ventilator_vt),
                ventilator_rate: toIntOrNull(record.ventilator_rate),
                ventilator_peep: toIntOrNull(record.ventilator_peep),
            }

            if (recordMeta.id) {
                await updateAnaesthesiaRecord(caseId, payload)
            } else {
                const res = await createAnaesthesiaRecord(caseId, payload)
                setRecordMeta({ id: res.data.id, created_at: res.data.created_at })
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
        if (!recordMeta.id) {
            setError('Save the anaesthesia record before adding vitals.')
            return
        }
        if (!newVital.time) {
            setError('Time is required for vitals (HH:MM).')
            return
        }
        setVitalBusy(true)
        setError(null)
        setSuccess(null)
        try {
            const payload = {
                ...newVital,
                hr: newVital.hr ? Number(newVital.hr) : null,
                spo2: newVital.spo2 ? Number(newVital.spo2) : null,
                rr: newVital.rr ? Number(newVital.rr) : null,
                temp_c: newVital.temp_c ? Number(newVital.temp_c) : null,
                etco2: newVital.etco2 ? Number(newVital.etco2) : null,
                peak_airway_pressure: newVital.peak_airway_pressure
                    ? Number(newVital.peak_airway_pressure)
                    : null,
                cvp_pcwp: newVital.cvp_pcwp ? Number(newVital.cvp_pcwp) : null,
                urine_output_ml: newVital.urine_output_ml
                    ? Number(newVital.urine_output_ml)
                    : null,
                blood_loss_ml: newVital.blood_loss_ml
                    ? Number(newVital.blood_loss_ml)
                    : null,
            }
            const res = await createAnaesthesiaVital(recordMeta.id, payload)
            setVitals((prev) => [...prev, res.data])
            setNewVital(emptyVital)
            setSuccess('Vitals entry added.')
        } catch (err) {
            console.error('Add vital error', err)
            setError('Unable to add vitals entry.')
        } finally {
            setVitalBusy(false)
        }
    }

    const handleDeleteVital = async (id) => {
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
        if (!recordMeta.id) {
            setError('Save the anaesthesia record before adding drug log.')
            return
        }
        if (!newDrug.time || !newDrug.drug_name) {
            setError('Drug time and name are required.')
            return
        }
        setDrugBusy(true)
        setError(null)
        setSuccess(null)
        try {
            const res = await createAnaesthesiaDrug(recordMeta.id, newDrug)
            setDrugs((prev) => [...prev, res.data])
            setNewDrug(emptyDrug)
            setSuccess('Drug log entry added.')
        } catch (err) {
            console.error('Add drug error', err)
            setError('Unable to add drug log entry.')
        } finally {
            setDrugBusy(false)
        }
    }

    const handleDeleteDrug = async (id) => {
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
            {/* LEFT: physical exam */}
            <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ClipboardList className="h-4 w-4" />
                    Pre-anaesthetic assessment
                </h3>

                <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
                    <TextInput label="ASA Grade" value={record.asa_grade} onChange={(v) => handleField('asa_grade', v)} />
                    <TextInput label="Anaesthesia type" value={record.anaesthesia_type} onChange={(v) => handleField('anaesthesia_type', v)} />
                    <TextInput label="Co-morbidities" value={record.comorbidities} onChange={(v) => handleField('comorbidities', v)} />
                    <TextInput label="Allergies" value={record.allergies} onChange={(v) => handleField('allergies', v)} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
                    <TextInput label="Pulse" value={record.preop_pulse} onChange={(v) => handleField('preop_pulse', v)} />
                    <TextInput label="BP" value={record.preop_bp} onChange={(v) => handleField('preop_bp', v)} />
                    <TextInput label="RR" value={record.preop_rr} onChange={(v) => handleField('preop_rr', v)} />
                    <TextInput label="Temp (°C)" value={record.preop_temp_c} onChange={(v) => handleField('preop_temp_c', v)} />
                </div>

                <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
                    <TextInput label="CVS" value={record.preop_cvs} onChange={(v) => handleField('preop_cvs', v)} />
                    <TextInput label="RS" value={record.preop_rs} onChange={(v) => handleField('preop_rs', v)} />
                    <TextInput label="CNS" value={record.preop_cns} onChange={(v) => handleField('preop_cns', v)} />
                    <TextInput label="PA" value={record.preop_pa} onChange={(v) => handleField('preop_pa', v)} />
                    <TextInput label="Veins" value={record.preop_veins} onChange={(v) => handleField('preop_veins', v)} />
                    <TextInput label="Spine" value={record.preop_spine} onChange={(v) => handleField('preop_spine', v)} />
                </div>
            </div>

            {/* RIGHT: airway + risk */}
            <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Activity className="h-4 w-4" />
                    Airway & risk
                </h3>

                <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
                    <TextInput
                        label="Teeth"
                        placeholder="Intact / Loose"
                        value={record.airway_teeth_status}
                        onChange={(v) => handleField('airway_teeth_status', v)}
                    />
                    <TextInput
                        label="Denture"
                        placeholder="Present / Absent"
                        value={record.airway_denture}
                        onChange={(v) => handleField('airway_denture', v)}
                    />
                    <TextInput
                        label="Neck movements"
                        value={record.airway_neck_movements}
                        onChange={(v) => handleField('airway_neck_movements', v)}
                    />
                    <TextInput
                        label="Mallampati class"
                        placeholder="Class 1 / 2 / 3 / 4"
                        value={record.airway_mallampati_class}
                        onChange={(v) => handleField('airway_mallampati_class', v)}
                    />
                </div>

                <div className="flex items-center gap-2 text-[12px]">
                    <label className="inline-flex items-center gap-1.5">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300"
                            checked={record.difficult_airway_anticipated || false}
                            onChange={() => toggleBool('difficult_airway_anticipated')}
                        />
                        <span className="text-slate-700">Difficult airway anticipated</span>
                    </label>
                </div>

                <Textarea
                    label="Risk factors"
                    value={record.risk_factors}
                    onChange={(v) => handleField('risk_factors', v)}
                />
                <Textarea
                    label="Anaesthetic plan"
                    value={record.anaesthetic_plan_detail}
                    onChange={(v) => handleField('anaesthetic_plan_detail', v)}
                />
                <Textarea
                    label="Pre-op instructions"
                    value={record.preop_instructions}
                    onChange={(v) => handleField('preop_instructions', v)}
                />
            </div>
        </div>
    )

    const renderIntraOp = () => (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Induction & intubation */}
                <div className="space-y-3 rounded-2xl border bg-white p-4 text-[12px] shadow-sm">
                    <h3 className="mb-1 text-sm font-semibold text-slate-900">
                        Induction & intubation
                    </h3>

                    <div className="flex flex-wrap gap-3">
                        <Checkbox
                            label="Preoxygenation"
                            checked={record.preoxygenation}
                            onChange={() => toggleBool('preoxygenation')}
                        />
                        <Checkbox
                            label="Cricoid pressure"
                            checked={record.cricoid_pressure}
                            onChange={() => toggleBool('cricoid_pressure')}
                        />
                    </div>

                    <Select
                        label="Induction"
                        value={record.induction_route}
                        onChange={(v) => handleField('induction_route', v)}
                        options={[
                            '',
                            'Intravenous',
                            'Inhalational',
                            'Rapid sequence',
                        ]}
                    />

                    <Checkbox
                        label="Intubation done"
                        checked={record.intubation_done}
                        onChange={() => toggleBool('intubation_done')}
                    />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                            label="Route"
                            value={record.intubation_route}
                            onChange={(v) => handleField('intubation_route', v)}
                            options={['', 'Oral', 'Nasal']}
                        />
                        <Select
                            label="State"
                            value={record.intubation_state}
                            onChange={(v) => handleField('intubation_state', v)}
                            options={['', 'Awake', 'Anaesthetised']}
                        />
                        <Select
                            label="Technique"
                            value={record.intubation_technique}
                            onChange={(v) => handleField('intubation_technique', v)}
                            options={['', 'Visual', 'Blind', 'Fibreoptic', 'Retrograde']}
                        />
                        <TextInput
                            label="Laryngoscopy grade"
                            placeholder="I / II / III / IV"
                            value={record.laryngoscopy_grade}
                            onChange={(v) => handleField('laryngoscopy_grade', v)}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextInput label="Tube type" value={record.tube_type} onChange={(v) => handleField('tube_type', v)} />
                        <TextInput label="Size" value={record.tube_size} onChange={(v) => handleField('tube_size', v)} />
                        <TextInput label="Fixed at" value={record.tube_fixed_at} onChange={(v) => handleField('tube_fixed_at', v)} />
                        <Select
                            label="Cuff medium"
                            value={record.cuff_medium}
                            onChange={(v) => handleField('cuff_medium', v)}
                            options={['', 'Air', 'Saline', 'Not inflated']}
                        />
                    </div>

                    <Checkbox
                        label="Cuff used"
                        checked={record.cuff_used}
                        onChange={() => toggleBool('cuff_used')}
                    />

                    <TextInput
                        label="Bilateral breath sounds"
                        value={record.bilateral_breath_sounds}
                        onChange={(v) => handleField('bilateral_breath_sounds', v)}
                    />
                    <TextInput
                        label="Added sounds"
                        value={record.added_sounds}
                        onChange={(v) => handleField('added_sounds', v)}
                    />
                </div>

                {/* Airway devices + monitors */}
                <div className="space-y-3 rounded-2xl border bg-white p-4 text-[12px] shadow-sm">
                    <h3 className="mb-1 text-sm font-semibold text-slate-900">
                        Airway devices & monitors
                    </h3>

                    <div className="mb-2 text-[11px] font-semibold text-slate-600">
                        Airway devices
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {['Face mask', 'LMA/ILMA', 'Oral airway', 'Throat pack', 'NG tube', 'Other'].map(
                            (label) => (
                                <Checkbox
                                    key={label}
                                    label={label}
                                    checked={(record.airway_devices || []).includes(label)}
                                    onChange={() => toggleDevice(label)}
                                />
                            ),
                        )}
                    </div>

                    <div className="mt-3 text-[11px] font-semibold text-slate-600">
                        Monitors
                    </div>
                    <div className="grid grid-cols-2 gap-1">
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
                                checked={record.monitors?.[key] || false}
                                onChange={() => toggleMonitor(key)}
                            />
                        ))}
                    </div>
                </div>

                {/* Ventilation, position, fluids, block */}
                <div className="space-y-3 rounded-2xl border bg-white p-4 text-[12px] shadow-sm">
                    <h3 className="mb-1 text-sm font-semibold text-slate-900">
                        Ventilation & block
                    </h3>

                    <Select
                        label="Ventilation mode"
                        value={record.ventilation_mode_baseline}
                        onChange={(v) => handleField('ventilation_mode_baseline', v)}
                        options={['', 'Spontaneous', 'Controlled', 'Manual', 'Ventilator']}
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <TextInput
                            label="Vt (ml)"
                            value={record.ventilator_vt}
                            onChange={(v) => handleField('ventilator_vt', v)}
                        />
                        <TextInput
                            label="Rate (f)"
                            value={record.ventilator_rate}
                            onChange={(v) => handleField('ventilator_rate', v)}
                        />
                        <TextInput
                            label="PEEP (cmH₂O)"
                            value={record.ventilator_peep}
                            onChange={(v) => handleField('ventilator_peep', v)}
                        />
                    </div>

                    <Select
                        label="Breathing system"
                        value={record.breathing_system}
                        onChange={(v) => handleField('breathing_system', v)}
                        options={[
                            '',
                            'Mapleson A',
                            'Mapleson D',
                            'Mapleson F',
                            'Circle system',
                            'Other',
                        ]}
                    />

                    <div className="mt-2 text-[11px] font-semibold text-slate-600">
                        Position & protection
                    </div>
                    <Select
                        label="Patient position"
                        value={record.patient_position}
                        onChange={(v) => handleField('patient_position', v)}
                        options={['', 'Supine', 'Lateral', 'Prone', 'Lithotomy', 'Other']}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Checkbox
                            label="Eyes taped"
                            checked={record.eyes_taped}
                            onChange={() => toggleBool('eyes_taped')}
                        />
                        <Checkbox
                            label="Eyes covered with foil"
                            checked={record.eyes_covered_with_foil}
                            onChange={() => toggleBool('eyes_covered_with_foil')}
                        />
                        <Checkbox
                            label="Pressure points padded"
                            checked={record.pressure_points_padded}
                            onChange={() => toggleBool('pressure_points_padded')}
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
                                checked={record.lines?.[key] || false}
                                onChange={() => toggleLine(key)}
                            />
                        ))}
                    </div>
                    <Checkbox
                        label="Tourniquet used"
                        checked={record.tourniquet_used}
                        onChange={() => toggleBool('tourniquet_used')}
                    />

                    <TextInput
                        label="IV fluids plan"
                        value={record.iv_fluids_plan}
                        onChange={(v) => handleField('iv_fluids_plan', v)}
                    />
                    <TextInput
                        label="Blood & components plan"
                        value={record.blood_components_plan}
                        onChange={(v) => handleField('blood_components_plan', v)}
                    />

                    <div className="mt-2 text-[11px] font-semibold text-slate-600">
                        Regional block
                    </div>
                    <Select
                        label="Type"
                        value={record.regional_block_type}
                        onChange={(v) => handleField('regional_block_type', v)}
                        options={['', 'Spinal', 'Epidural', 'Nerve block', 'Combined', 'None']}
                    />
                    <TextInput
                        label="Position"
                        value={record.regional_position}
                        onChange={(v) => handleField('regional_position', v)}
                    />
                    <TextInput
                        label="Approach"
                        value={record.regional_approach}
                        onChange={(v) => handleField('regional_approach', v)}
                    />
                    <TextInput
                        label="Space & depth"
                        value={record.regional_space_depth}
                        onChange={(v) => handleField('regional_space_depth', v)}
                    />
                    <TextInput
                        label="Needle type"
                        value={record.regional_needle_type}
                        onChange={(v) => handleField('regional_needle_type', v)}
                    />
                    <TextInput
                        label="Drug injected / dose"
                        value={record.regional_drug_dose}
                        onChange={(v) => handleField('regional_drug_dose', v)}
                    />
                    <TextInput
                        label="Level of anaesthesia"
                        value={record.regional_level}
                        onChange={(v) => handleField('regional_level', v)}
                    />
                    <TextInput
                        label="Complications"
                        value={record.regional_complications}
                        onChange={(v) => handleField('regional_complications', v)}
                    />

                    <Select
                        label="Adequacy of block"
                        value={record.block_adequacy}
                        onChange={(v) => handleField('block_adequacy', v)}
                        options={['', 'Excellent', 'Adequate', 'Poor']}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Checkbox
                            label="Sedation needed"
                            checked={record.sedation_needed}
                            onChange={() => toggleBool('sedation_needed')}
                        />
                        <Checkbox
                            label="Conversion to GA"
                            checked={record.conversion_to_ga}
                            onChange={() => toggleBool('conversion_to_ga')}
                        />
                    </div>
                </div>
            </div>

            <Textarea
                label="Intra-op summary / notes"
                value={record.notes || ''}
                onChange={(v) => handleField('notes', v)}
            />
        </div>
    )

    const renderVitals = () => (
        <div className="space-y-3 rounded-2xl border bg-white p-4 text-[12px] shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Activity className="h-4 w-4" />
                Intra-op vitals log
            </h3>

            {/* Add row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <TextInput
                    label="Time (HH:MM)"
                    value={newVital.time}
                    onChange={(v) => setNewVital((p) => ({ ...p, time: v }))}
                />
                <TextInput
                    label="HR"
                    value={newVital.hr}
                    onChange={(v) => setNewVital((p) => ({ ...p, hr: v }))}
                />
                <TextInput
                    label="BP"
                    value={newVital.bp}
                    onChange={(v) => setNewVital((p) => ({ ...p, bp: v }))}
                />
                <TextInput
                    label="SpO₂"
                    value={newVital.spo2}
                    onChange={(v) => setNewVital((p) => ({ ...p, spo2: v }))}
                />
                <TextInput
                    label="RR"
                    value={newVital.rr}
                    onChange={(v) => setNewVital((p) => ({ ...p, rr: v }))}
                />
                <TextInput
                    label="Temp °C"
                    value={newVital.temp_c}
                    onChange={(v) => setNewVital((p) => ({ ...p, temp_c: v }))}
                />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <TextInput
                    label="ETCO₂"
                    value={newVital.etco2}
                    onChange={(v) => setNewVital((p) => ({ ...p, etco2: v }))}
                />
                <TextInput
                    label="Vent mode"
                    value={newVital.ventilation_mode}
                    onChange={(v) => setNewVital((p) => ({ ...p, ventilation_mode: v }))}
                />
                <TextInput
                    label="Peak P (cmH₂O)"
                    value={newVital.peak_airway_pressure}
                    onChange={(v) =>
                        setNewVital((p) => ({ ...p, peak_airway_pressure: v }))
                    }
                />
                <TextInput
                    label="CVP / PCWP"
                    value={newVital.cvp_pcwp}
                    onChange={(v) => setNewVital((p) => ({ ...p, cvp_pcwp: v }))}
                />
                <TextInput
                    label="Urine (ml)"
                    value={newVital.urine_output_ml}
                    onChange={(v) => setNewVital((p) => ({ ...p, urine_output_ml: v }))}
                />
                <TextInput
                    label="Blood loss (ml)"
                    value={newVital.blood_loss_ml}
                    onChange={(v) => setNewVital((p) => ({ ...p, blood_loss_ml: v }))}
                />
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <div className="flex-1">
                    <TextInput
                        label="ST segment / comments"
                        value={newVital.st_segment || newVital.comments}
                        onChange={(v) =>
                            setNewVital((p) => ({ ...p, st_segment: v, comments: v }))
                        }
                    />
                </div>
                <button
                    type="button"
                    onClick={handleAddVital}
                    disabled={vitalBusy}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {vitalBusy ? 'Adding…' : 'Add vitals'}
                </button>
            </div>

            {/* List */}
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
                                        <button
                                            onClick={() => handleDeleteVital(v.id)}
                                            className="text-xs font-semibold text-red-500 hover:underline"
                                        >
                                            Delete
                                        </button>
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

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <TextInput
                    label="Time (HH:MM)"
                    value={newDrug.time}
                    onChange={(v) => setNewDrug((p) => ({ ...p, time: v }))}
                />
                <TextInput
                    label="Drug name"
                    value={newDrug.drug_name}
                    onChange={(v) => setNewDrug((p) => ({ ...p, drug_name: v }))}
                />
                <TextInput
                    label="Dose"
                    value={newDrug.dose}
                    onChange={(v) => setNewDrug((p) => ({ ...p, dose: v }))}
                />
                <TextInput
                    label="Route"
                    value={newDrug.route}
                    onChange={(v) => setNewDrug((p) => ({ ...p, route: v }))}
                />
                <TextInput
                    label="Remarks"
                    value={newDrug.remarks}
                    onChange={(v) => setNewDrug((p) => ({ ...p, remarks: v }))}
                />
            </div>

            <button
                type="button"
                onClick={handleAddDrug}
                disabled={drugBusy}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {drugBusy ? 'Adding…' : 'Add drug'}
            </button>

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
                                        <button
                                            onClick={() => handleDeleteDrug(d.id)}
                                            className="text-xs font-semibold text-red-500 hover:underline"
                                        >
                                            Delete
                                        </button>
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

            {/* Sub-tabs header */}
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

            {/* Body */}
            {subTab === 'preop' && renderPreop()}
            {subTab === 'intra' && renderIntraOp()}
            {subTab === 'vitals' && renderVitals()}
            {subTab === 'drugs' && renderDrugs()}

            {/* Save bar */}
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

function TextInput({ label, value, onChange, placeholder }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
            <input
                className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white"
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function Textarea({ label, value, onChange, placeholder }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
            <textarea
                className="min-h-[70px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white"
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function Checkbox({ label, checked, onChange }) {
    return (
        <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700">
            <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-0"
                checked={!!checked}
                onChange={onChange}
            />
            <span>{label}</span>
        </label>
    )
}

function Select({ label, value, onChange, options }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
            <select
                className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
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
    return (
        <td className="px-2 py-1 align-top text-[11px] text-slate-700">
            {children}
        </td>
    )
}
