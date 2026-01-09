// FILE: src/ot/tabs/AnaesthesiaTab.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
    getAnaesthesiaRecordPdf,
    // ✅ if your backend provides defaults on 404 (your code already calls it)
    getAnaesthesiaRecordDefaults,
} from "../../api/ot"
import { useCan } from "../../hooks/useCan"
import {
    ClipboardList,
    Activity,
    Droplet,
    Syringe,
    AlertCircle,
    CheckCircle2,
    Stethoscope,
    Search,
    Download,
    RefreshCcw,
    Save,
    ShieldCheck,
    BadgeCheck,
    Clock,
    FileText,
    ChevronDown,
    LayoutGrid,
    ListChecks,
    Monitor,
    AirVent,
    Timer,
} from "lucide-react"
import { toast } from "sonner"

/* ---------------- blob helpers (pdf) ---------------- */
function filenameFromDisposition(disposition, fallback = "document.pdf") {
    if (!disposition) return fallback
    const m = String(disposition).match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
    if (!m?.[1]) return fallback
    try {
        return decodeURIComponent(m[1])
    } catch {
        return m[1]
    }
}

async function extractBlobError(err) {
    const blob = err?.response?.data
    const status = err?.response?.status
    if (blob instanceof Blob) {
        try {
            const text = await blob.text()
            try {
                const j = JSON.parse(text)
                const detail = j?.detail ?? j?.error?.msg ?? j?.message
                if (Array.isArray(detail)) return detail.map((x) => x?.msg || JSON.stringify(x)).join(", ")
                if (typeof detail === "object") return JSON.stringify(detail)
                return String(detail || text)
            } catch {
                return text || `Request failed (${status || "error"})`
            }
        } catch {
            return `Request failed (${status || "error"})`
        }
    }
    const d = err?.response?.data?.detail || err?.response?.data?.error?.msg
    if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(", ")
    return d || err?.message || `Request failed (${status || "error"})`
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function openPdfInNewTab(blob) {
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank", "noopener,noreferrer")
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * ✅ Smart print:
 * - Desktop Chrome/Edge: hidden iframe print works best
 * - iOS/Safari/mobile: open new tab fallback (iframe print often fails)
 */
function printBlobSmart(blob) {
    return new Promise((resolve) => {
        const ua = navigator.userAgent || ""
        const isIOS = /iPad|iPhone|iPod/i.test(ua)
        const isSafari = /^((?!chrome|android).)*safari/i.test(ua)
        const isMobile = window.matchMedia?.("(pointer: coarse)").matches

        if (isIOS || (isSafari && isMobile)) {
            openPdfInNewTab(blob)
            resolve()
            return
        }

        const url = URL.createObjectURL(blob)
        const iframe = document.createElement("iframe")
        iframe.style.position = "fixed"
        iframe.style.right = "0"
        iframe.style.bottom = "0"
        iframe.style.width = "1px"
        iframe.style.height = "1px"
        iframe.style.opacity = "0"
        iframe.style.border = "0"
        iframe.src = url

        let done = false
        const cleanup = () => {
            if (done) return
            done = true
            try {
                iframe.remove()
            } catch { }
            setTimeout(() => URL.revokeObjectURL(url), 2000)
            resolve()
        }

        iframe.onload = () => {
            try {
                const win = iframe.contentWindow
                if (!win) throw new Error("no iframe window")
                win.onafterprint = cleanup
                win.focus()
                win.print()
                setTimeout(cleanup, 3000)
            } catch {
                openPdfInNewTab(blob)
                cleanup()
            }
        }

        document.body.appendChild(iframe)
    })
}

/* ---------------- data shapes ---------------- */
const emptyRecord = {
    // ✅ Page-1 Pre-anaesthetic fields
    patient_prefix: "",
    diagnosis: "",
    proposed_operation: "",
    weight: "",
    height: "",
    hb: "",
    blood_group: "",
    investigation_reports: "",
    history: "",

    anaesthesia_type: "",
    asa_grade: "",
    asa_emergency: false,
    airway_assessment: "",
    comorbidities: "",
    allergies: "",

    preop_pulse: "",
    preop_bp: "",
    preop_rr: "",
    preop_temp_c: "",
    preop_cvs: "",
    preop_rs: "",
    preop_cns: "",
    preop_pa: "",
    preop_veins: "",
    preop_spine: "",

    airway_teeth_status: "",
    airway_denture: "",
    airway_neck_movements: "",
    airway_mallampati_class: "",
    difficult_airway_anticipated: false,

    risk_factors: "",
    anaesthetic_plan_detail: "",
    preop_instructions: "",

    // ✅ Pre-op checklist (JSON)
    preop_checklist: {
        consent_taken: false,
        npo_confirmed: false,
        allergy_checked: false,
        investigations_reviewed: false,
        airway_evaluated: false,
        iv_access_secured: false,
        monitors_ready: false,
        suction_ready: false,
        drugs_ready: false,
        blood_arranged_if_needed: false,
    },

    // ✅ Intra-op header (from your paper)
    intra_date: "",
    intra_anaesthesiologist: "",
    intra_surgeon: "",
    intra_or_no: "",
    intra_case_type: "", // Elective / Emergency
    intra_surgical_procedure: "",
    intra_anaesthesia_type: "", // General / Regional / MAC
    intra_anaesthesia_start: "",
    intra_anaesthesia_finish: "",
    intra_surgery_start: "",
    intra_surgery_finish: "",

    // intra-op setup (airway)
    preoxygenation: false,
    cricoid_pressure: false,
    induction_route: "",
    intubation_done: false,
    intubation_route: "",
    intubation_state: "",
    intubation_technique: "",
    tube_type: "",
    tube_size: "",
    tube_fixed_at: "",
    cuff_used: false,
    cuff_medium: "",
    bilateral_breath_sounds: "",
    added_sounds: "",
    laryngoscopy_grade: "",

    // legacy fields
    airway_devices: [],
    monitors: {},
    lines: {},

    // master-driven fields
    airway_device_ids: [],
    monitor_device_ids: [],

    // ventilation / position / protection
    ventilation_mode_baseline: "",
    ventilator_vt: "",
    ventilator_rate: "",
    ventilator_peep: "",
    breathing_system: "",
    breathing_system_other: "",
    tourniquet_used: false,
    tourniquet_details: "",
    patient_position: "",
    patient_position_other: "",
    eyes_taped: false,
    eyes_covered_with_foil: false,
    pressure_points_padded: false,

    // ✅ paper boxes: IV Fluids / Blood / Antibiotics / Totals
    iv_fluids_plan: "",
    blood_components_plan: "",
    iv_fluids_given: "",
    blood_components_given: "",
    antibiotics_given: "",
    total_input_ml: "",
    total_output_ml: "",

    // Lines notes (paper has a free box)
    lines_notes: "",

    // regional block
    regional_block_type: "",
    regional_position: "",
    regional_approach: "",
    regional_space_depth: "",
    regional_needle_type: "",
    regional_drug_dose: "",
    regional_level: "",
    regional_complications: "",
    block_adequacy: "",
    sedation_needed: false,
    conversion_to_ga: false,

    // Post-op (NEW TAB)
    postop_destination: "",
    postop_extubated: false,
    postop_extubation_time: "",
    postop_reversal_given: false,
    postop_reversal_drugs: "",
    postop_bp: "",
    postop_hr: "",
    postop_spo2: "",
    postop_rr: "",
    postop_temp_c: "",
    postop_pain_score: "",
    postop_nausea_vomiting: "",
    postop_complications: "",
    postop_notes: "",

    // optional misc (your UI already uses notes)
    notes: "",
}

const emptyVital = {
    time: "",
    hr: "",
    bp: "",
    spo2: "",
    rr: "",
    temp_c: "",
    etco2: "",
    ventilation_mode: "",
    peak_airway_pressure: "",
    cvp_pcwp: "",
    st_segment: "",
    urine_output_ml: "",
    blood_loss_ml: "",
    comments: "",

    // ✅ Paper gas chart row (NEW)
    oxygen_fio2: "",
    n2o: "",
    air: "",
    agent: "",
    iv_fluids: "",
}

const emptyDrug = {
    time: "",
    drug_name: "",
    dose: "",
    route: "",
    remarks: "",
}

/* ---------------- tiny helpers ---------------- */
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
    const [hh, mm] = s.split(":").map((x) => parseInt(x, 10))
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59
}
function formatHHMM(v) {
    if (!v) return "—"
    const s = String(v).trim()
    const m = s.match(/^(\d{2}):(\d{2})/)
    if (m) return `${m[1]}:${m[2]}`
    try {
        const d = new Date(s)
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            })
        }
    } catch { }
    return s
}
function formatDateTimeIST(v) {
    if (!v) return ""
    try {
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return String(v)
        return d.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        })
    } catch {
        return String(v)
    }
}

function parseHHMMToMinutes(t) {
    if (!t) return null
    const s = String(t).trim()
    const m = s.match(/^(\d{2}):(\d{2})/)
    if (!m) return null
    const hh = parseInt(m[1], 10)
    const mm = parseInt(m[2], 10)
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null
    return hh * 60 + mm
}

function parseBp(bp) {
    if (!bp) return { sys: null, dia: null }
    const s = String(bp).trim()
    const m = s.match(/(\d{2,3})\s*[/\-]\s*(\d{2,3})/)
    if (m) return { sys: toIntOrNull(m[1]), dia: toIntOrNull(m[2]) }
    const single = toIntOrNull(s)
    return { sys: single, dia: null }
}

function normalizeRecord(data) {
    if (!data) {
        return {
            record: { ...emptyRecord },
            meta: { id: null, created_at: null },
            vitals: [],
            drugs: [],
        }
    }

    const monitors = data.monitors && typeof data.monitors === "object" ? data.monitors : {}
    const lines = data.lines && typeof data.lines === "object" ? data.lines : {}
    const airway_devices = Array.isArray(data.airway_devices) ? data.airway_devices : []

    const airway_device_ids = uniqIntList(data.airway_device_ids)
    const monitor_device_ids = uniqIntList(data.monitor_device_ids)

    const preop_checklist =
        data.preop_checklist && typeof data.preop_checklist === "object"
            ? data.preop_checklist
            : { ...emptyRecord.preop_checklist }

    return {
        record: {
            ...emptyRecord,
            ...data,
            monitors,
            lines,
            airway_devices,
            airway_device_ids,
            monitor_device_ids,
            preop_checklist,
        },
        meta: { id: data.id ?? null, created_at: data.created_at ?? null },
        vitals: [],
        drugs: [],
    }
}

/**
 * ✅ AnaesthesiaTab (UI redesign only)
 * Props:
 *  - caseId: OT case id
 */
export default function AnaesthesiaTab({ caseId }) {
    const p1 = useCan("ot.anaesthesia_record.view")
    const p2 = useCan("ot.anaesthesia.view")
    const p3 = useCan("ot.cases.view")
    const p4 = useCan("ipd.view")

    const e1 = useCan("ot.anaesthesia_record.update")
    const e2 = useCan("ot.anaesthesia_record.create")
    const e3 = useCan("ot.anaesthesia.update")
    const e4 = useCan("ot.anaesthesia.create")
    const e5 = useCan("ot.cases.update")
    const e6 = useCan("ipd.doctor")

    const canView = p1 || p2 || p3 || p4
    const canEdit = e1 || e2 || e3 || e4 || e5 || e6

    // ✅ Tabs
    const [subTab, setSubTab] = useState("preop") // preop | intra | postop | vitals | drugs

    const [record, setRecord] = useState({ ...emptyRecord })
    const [recordMeta, setRecordMeta] = useState({ id: null, created_at: null })

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [busyRefresh, setBusyRefresh] = useState(false)

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
    const [deviceQ, setDeviceQ] = useState("")

    const safeRecord = record || emptyRecord

    // ✅ PDF (preop / full)
    const [pdfBusy, setPdfBusy] = useState(null)
    const canPdf = !!caseId && !!recordMeta?.id

    const handleDownloadPreopPdf = async () => {
        if (!canPdf) return toast.error("Save anaesthesia record first")
        setPdfBusy("dl-preop")
        try {
            const res = await getAnaesthesiaRecordPdf(caseId, { download: true, section: "preop" })
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: "application/pdf" })
            const cd = res?.headers?.["content-disposition"]
            const fname = filenameFromDisposition(cd, `OT_PreAnaesthetic_Record_Case_${caseId}.pdf`)
            downloadBlob(blob, fname)
            toast.success("Pre-Anaesthetic PDF downloaded")
        } catch (e) {
            toast.error(await extractBlobError(e))
        } finally {
            setPdfBusy(null)
        }
    }

    const handlePrintPreopPdf = async () => {
        if (!canPdf) return toast.error("Save anaesthesia record first")
        setPdfBusy("print-preop")
        try {
            const res = await getAnaesthesiaRecordPdf(caseId, { download: false, section: "preop" })
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: "application/pdf" })
            toast.message("Opening print preview…")
            await printBlobSmart(blob)
        } catch (e) {
            toast.error(await extractBlobError(e))
        } finally {
            setPdfBusy(null)
        }
    }

    const handleDownloadFullPdf = async () => {
        if (!canPdf) return toast.error("Save anaesthesia record first")
        setPdfBusy("dl-full")
        try {
            const res = await getAnaesthesiaRecordPdf(caseId, { download: true, section: "full" })
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: "application/pdf" })
            const cd = res?.headers?.["content-disposition"]
            const fname = filenameFromDisposition(cd, `OT_Anaesthesia_Record_Case_${caseId}.pdf`)
            downloadBlob(blob, fname)
            toast.success("Full PDF downloaded")
        } catch (e) {
            toast.error(await extractBlobError(e))
        } finally {
            setPdfBusy(null)
        }
    }

    const handlePrintFullPdf = async () => {
        if (!canPdf) return toast.error("Save anaesthesia record first")
        setPdfBusy("print-full")
        try {
            const res = await getAnaesthesiaRecordPdf(caseId, { download: false, section: "full" })
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: "application/pdf" })
            toast.message("Opening print preview…")
            await printBlobSmart(blob)
        } catch (e) {
            toast.error(await extractBlobError(e))
        } finally {
            setPdfBusy(null)
        }
    }

    /* ---------------- core state updaters ---------------- */
    const handleField = (name, value) => {
        setRecord((prev) => ({ ...(prev || emptyRecord), [name]: value }))
    }
    const toggleBool = (name) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            return { ...base, [name]: !base[name] }
        })
    }
    const toggleChecklist = (key) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            const cl = base.preop_checklist && typeof base.preop_checklist === "object" ? base.preop_checklist : {}
            return {
                ...base,
                preop_checklist: { ...cl, [key]: !cl[key] },
            }
        })
    }

    const toggleLegacyMonitor = (key) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            const m = base.monitors && typeof base.monitors === "object" ? base.monitors : {}
            return { ...base, monitors: { ...m, [key]: !m[key] } }
        })
    }
    const toggleLine = (key) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            const l = base.lines && typeof base.lines === "object" ? base.lines : {}
            return { ...base, lines: { ...l, [key]: !l[key] } }
        })
    }
    const toggleLegacyAirwayDevice = (value) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            const arr = Array.isArray(base.airway_devices) ? base.airway_devices : []
            if (arr.includes(value)) return { ...base, airway_devices: arr.filter((v) => v !== value) }
            return { ...base, airway_devices: [...arr, value] }
        })
    }
    const toggleDeviceId = (field, id) => {
        setRecord((prev) => {
            const base = prev || emptyRecord
            const arr = uniqIntList(base[field])
            if (arr.includes(id)) return { ...base, [field]: arr.filter((x) => x !== id) }
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
            (d) => String(d.name || "").toLowerCase().includes(q) || String(d.code || "").toLowerCase().includes(q),
        )
    }, [airwayMasters, deviceQ])

    const filteredMonitorMasters = useMemo(() => {
        const q = deviceQ.trim().toLowerCase()
        const src = monitorMasters || []
        if (!q) return src
        return src.filter(
            (d) => String(d.name || "").toLowerCase().includes(q) || String(d.code || "").toLowerCase().includes(q),
        )
    }, [monitorMasters, deviceQ])

    /* ---------------- LOAD (record + vitals + drugs) ---------------- */
    const loadAll = useCallback(async () => {
        if (!canView) {
            setLoading(false)
            return
        }
        if (!caseId) {
            setLoading(false)
            setError("Case ID is missing.")
            return
        }

        setError(null)
        setSuccess(null)
        setBusyRefresh(true)
        try {
            const res = await getAnaesthesiaRecord(caseId)
            const norm = normalizeRecord(res?.data)

            setRecord(norm.record)
            setRecordMeta(norm.meta)

            if (norm.meta.id) {
                const [vRes, dRes] = await Promise.all([listAnaesthesiaVitals(norm.meta.id), listAnaesthesiaDrugs(norm.meta.id)])
                setVitals(vRes?.data || [])
                setDrugs(dRes?.data || [])
            } else {
                setVitals([])
                setDrugs([])
            }
        } catch (err) {
            const status = err?.response?.status
            if (status === 404) {
                setRecord({ ...emptyRecord })
                setRecordMeta({ id: null, created_at: null })
                setVitals([])
                setDrugs([])
                try {
                    const d = await getAnaesthesiaRecordDefaults(caseId)
                    setRecord((prev) => ({ ...(prev || emptyRecord), ...(d?.data || {}) }))
                } catch { }
            } else if (status === 403) {
                setError("You do not have permission to view Anaesthesia records.")
            } else {
                console.error("Anaesthesia load error", err)
                setError("Unable to load anaesthesia record. Please try again.")
            }
        } finally {
            setBusyRefresh(false)
            setLoading(false)
        }
    }, [canView, caseId])

    useEffect(() => {
        let alive = true
            ; (async () => {
                if (!alive) return
                setLoading(true)
                await loadAll()
            })()
        return () => {
            alive = false
        }
    }, [loadAll])

    /* ---------------- LOAD device masters ---------------- */
    useEffect(() => {
        let alive = true
        const loadMasters = async () => {
            if (!canView) return
            setDeviceLoading(true)
            try {
                const call = (params) => listOtDeviceMasters(params)
                const [aRes, mRes] = await Promise.all([
                    call({ category: "AIRWAY", is_active: true }),
                    call({ category: "MONITOR", is_active: true }),
                ])
                if (!alive) return
                setAirwayMasters(aRes?.data || [])
                setMonitorMasters(mRes?.data || [])
            } catch (e) {
                console.warn("Device masters load failed (fallback to legacy lists)", e)
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

    /* ---------------- PERMISSION BLOCK ---------------- */
    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
                You do not have permission to view Anaesthesia records.
            </div>
        )
    }

    /* ---------------- banner (inline) ---------------- */
    const showBanner = useMemo(() => {
        if (!error && !success) return null
        return error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                    <div className="font-semibold">Action needed</div>
                    <div className="text-[12px] opacity-90">{error}</div>
                </div>
            </div>
        ) : (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                    <div className="font-semibold">Saved</div>
                    <div className="text-[12px] opacity-90">{success}</div>
                </div>
            </div>
        )
    }, [error, success])

    /* ---------------- SAVE record ---------------- */
    const handleSaveRecord = async () => {
        if (!canEdit) {
            setError("You do not have permission to edit anaesthesia records.")
            return
        }
        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            const asaNum = toIntOrNull(safeRecord.asa_grade)

            const payload = {
                ...(safeRecord || emptyRecord),

                asa_grade: asaNum ?? (safeRecord.asa_grade || ""),

                preop_checklist:
                    safeRecord.preop_checklist && typeof safeRecord.preop_checklist === "object"
                        ? safeRecord.preop_checklist
                        : { ...emptyRecord.preop_checklist },

                ventilator_vt: toIntOrNull(safeRecord.ventilator_vt),
                ventilator_rate: toIntOrNull(safeRecord.ventilator_rate),
                ventilator_peep: toIntOrNull(safeRecord.ventilator_peep),

                airway_device_ids: uniqIntList(safeRecord.airway_device_ids),
                monitor_device_ids: uniqIntList(safeRecord.monitor_device_ids),

                airway_devices: Array.isArray(safeRecord.airway_devices) ? safeRecord.airway_devices : [],
                monitors: safeRecord.monitors && typeof safeRecord.monitors === "object" ? safeRecord.monitors : {},
                lines: safeRecord.lines && typeof safeRecord.lines === "object" ? safeRecord.lines : {},
            }

            if (recordMeta.id) {
                await updateAnaesthesiaRecord(caseId, payload)
            } else {
                const res = await createAnaesthesiaRecord(caseId, payload)
                const created = normalizeRecord(res?.data)
                setRecord(created.record)
                setRecordMeta(created.meta)
            }

            setSuccess("Anaesthesia record saved.")
            toast.success("Anaesthesia record saved")
        } catch (err) {
            console.error("Save anaesthesia record error", err)
            setError("Unable to save anaesthesia record.")
            toast.error("Failed to save")
        } finally {
            setSaving(false)
        }
    }

    /* ---------------- VITALS ---------------- */
    const handleAddVital = async () => {
        if (!canEdit) return setError("You do not have permission to add vitals.")
        if (!recordMeta.id) return setError("Save the anaesthesia record before adding vitals.")
        if (!isValidHHMM(newVital.time)) return setError("Time is required for vitals in HH:MM format.")

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
                comments: newVital.comments || newVital.st_segment || "",
                st_segment: newVital.st_segment || "",
            }
            const res = await createAnaesthesiaVital(recordMeta.id, payload)
            setVitals((prev) => [...prev, res.data])
            setNewVital({ ...emptyVital })
            setSuccess("Vitals entry added.")
            toast.success("Vitals added")
        } catch (err) {
            console.error("Add vital error", err)
            setError("Unable to add vitals entry.")
            toast.error("Failed to add vitals")
        } finally {
            setVitalBusy(false)
        }
    }

    const handleDeleteVital = async (id) => {
        if (!canEdit) return setError("You do not have permission to delete vitals.")
        if (!window.confirm("Delete this vitals entry?")) return

        setVitalBusy(true)
        setError(null)
        setSuccess(null)
        try {
            await deleteAnaesthesiaVital(id)
            setVitals((prev) => prev.filter((v) => v.id !== id))
            setSuccess("Vitals entry deleted.")
            toast.success("Vitals deleted")
        } catch (err) {
            console.error("Delete vital error", err)
            setError("Unable to delete vitals entry.")
            toast.error("Failed to delete")
        } finally {
            setVitalBusy(false)
        }
    }

    /* ---------------- DRUGS ---------------- */
    const handleAddDrug = async () => {
        if (!canEdit) return setError("You do not have permission to add drug log entries.")
        if (!recordMeta.id) return setError("Save the anaesthesia record before adding drug log.")
        if (!isValidHHMM(newDrug.time) || !String(newDrug.drug_name || "").trim())
            return setError("Drug time (HH:MM) and name are required.")

        setDrugBusy(true)
        setError(null)
        setSuccess(null)
        try {
            const res = await createAnaesthesiaDrug(recordMeta.id, {
                ...newDrug,
                drug_name: String(newDrug.drug_name || "").trim(),
            })
            setDrugs((prev) => [...prev, res.data])
            setNewDrug({ ...emptyDrug })
            setSuccess("Drug log entry added.")
            toast.success("Drug entry added")
        } catch (err) {
            console.error("Add drug error", err)
            setError("Unable to add drug log entry.")
            toast.error("Failed to add drug")
        } finally {
            setDrugBusy(false)
        }
    }

    const handleDeleteDrug = async (id) => {
        if (!canEdit) return setError("You do not have permission to delete drug log entries.")
        if (!window.confirm("Delete this drug entry?")) return

        setDrugBusy(true)
        setError(null)
        setSuccess(null)
        try {
            await deleteAnaesthesiaDrug(id)
            setDrugs((prev) => prev.filter((d) => d.id !== id))
            setSuccess("Drug log entry deleted.")
            toast.success("Drug deleted")
        } catch (err) {
            console.error("Delete drug error", err)
            setError("Unable to delete drug entry.")
            toast.error("Failed to delete")
        } finally {
            setDrugBusy(false)
        }
    }

    /* ---------------- HERO ---------------- */
    const headerSubtitle = recordMeta?.id ? `Record ID: ${recordMeta.id}` : "No record yet (save to create)"
    const createdAtText = recordMeta?.created_at ? formatDateTimeIST(recordMeta.created_at) : null

    const checklistCount = useMemo(() => {
        const cl = safeRecord?.preop_checklist && typeof safeRecord.preop_checklist === "object" ? safeRecord.preop_checklist : {}
        const keys = Object.keys(emptyRecord.preop_checklist || {})
        const done = keys.reduce((n, k) => n + (cl?.[k] ? 1 : 0), 0)
        return { done, total: keys.length }
    }, [safeRecord?.preop_checklist])

    const SUBTABS = useMemo(
        () => [
            { key: "preop", label: "Pre-op", icon: ClipboardList, hint: `${checklistCount.done}/${checklistCount.total} checklist` },
            { key: "intra", label: "Intra-op", icon: Droplet, hint: "Airway • Devices • Fluids" },
            // { key: "postop", label: "Post-op", icon: ShieldCheck, hint: "Recovery & orders" },
            { key: "vitals", label: "Vitals", icon: Activity, hint: `${vitals.length} entries` },
            { key: "drugs", label: "Drugs", icon: Syringe, hint: `${drugs.length} entries` },
        ],
        [checklistCount.done, checklistCount.total, vitals.length, drugs.length],
    )

    if (loading) {
        return (
            <SoftCard className="p-4 md:p-6">
                <div className="h-10 w-60 animate-pulse rounded-2xl bg-slate-100" />
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
                </div>
            </SoftCard>
        )
    }

    return (
        <div className="relative">
            {/* subtle background for OT readability */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-white" />
            <div className="space-y-3">
                {showBanner}

                <SoftCard className="overflow-hidden">
                    {/* Header */}
                    <div className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/70 px-3 py-3 md:px-6 md:py-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                                        <Stethoscope className="h-5 w-5" />
                                    </span>

                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="truncate text-[15px] font-semibold text-slate-900 md:text-[16px]">
                                                OT Anaesthesia Record
                                            </h2>

                                            {recordMeta?.id ? (
                                                <Pill tone="emerald" icon={BadgeCheck}>
                                                    Saved
                                                </Pill>
                                            ) : (
                                                <Pill tone="slate" icon={FileText}>
                                                    Draft
                                                </Pill>
                                            )}

                                            {!canEdit ? (
                                                <Pill tone="amber" icon={ShieldCheck}>
                                                    Read-only
                                                </Pill>
                                            ) : null}
                                        </div>

                                        <div className="mt-0.5 text-[12px] text-slate-500">
                                            Designed for OT flow: quick fields on top, long fields in collapsible sections
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Chip icon={ShieldCheck}>
                                        <span className="text-slate-500">Case</span>
                                        <span className="font-semibold text-slate-900">#{caseId || "—"}</span>
                                    </Chip>
                                    <Chip icon={FileText}>
                                        <span className="text-slate-500">Status</span>
                                        <span className="font-semibold text-slate-900">{headerSubtitle}</span>
                                    </Chip>
                                    {createdAtText ? (
                                        <Chip icon={Clock}>
                                            <span className="text-slate-500">Created</span>
                                            <span className="font-semibold text-slate-900">{createdAtText}</span>
                                        </Chip>
                                    ) : null}

                                    <Chip icon={ListChecks}>
                                        <span className="text-slate-500">Checklist</span>
                                        <span className="font-semibold text-slate-900">
                                            {checklistCount.done}/{checklistCount.total}
                                        </span>
                                    </Chip>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                                <ActionButton
                                    onClick={loadAll}
                                    disabled={busyRefresh}
                                    icon={RefreshCcw}
                                    label="Refresh"
                                    busy={busyRefresh}
                                    variant="outline"
                                />

                                <PdfHubButton
                                    disabled={!canPdf || !!pdfBusy}
                                    busyKey={pdfBusy}
                                    onPrintPreop={handlePrintPreopPdf}
                                    onDownloadPreop={handleDownloadPreopPdf}
                                    onPrintFull={handlePrintFullPdf}
                                    onDownloadFull={handleDownloadFullPdf}
                                />

                                {canEdit ? (
                                    <ActionButton onClick={handleSaveRecord} disabled={saving} icon={Save} label="Save" busy={saving} variant="dark" />
                                ) : null}
                            </div>
                        </div>

                        {!canPdf ? (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700">
                                <b>Tip:</b> Save once to enable PDF print/download.
                            </div>
                        ) : null}
                    </div>

                    {/* Main nav (OT friendly) */}
                    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
                        <div className="px-2 py-2 md:px-4">
                            <div className="flex gap-2 overflow-x-auto">
                                {SUBTABS.map((t) => (
                                    <NavPill
                                        key={t.key}
                                        active={subTab === t.key}
                                        onClick={() => setSubTab(t.key)}
                                        icon={t.icon}
                                        label={t.label}
                                        hint={t.hint}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-3 md:p-6">
                        {subTab === "preop" && renderPreop({ safeRecord, canEdit, handleField, toggleBool, toggleChecklist })}
                        {subTab === "intra" &&
                            renderIntraOp({
                                safeRecord,
                                canEdit,
                                handleField,
                                toggleBool,
                                toggleLine,
                                toggleLegacyMonitor,
                                toggleLegacyAirwayDevice,
                                deviceQ,
                                setDeviceQ,
                                deviceLoading,
                                filteredAirwayMasters,
                                filteredMonitorMasters,
                                selectedAirwayIds,
                                selectedMonitorIds,
                                toggleDeviceId,
                                airwayMasters,
                                monitorMasters,
                            })}
                        {subTab === "postop" && renderPostop({ safeRecord, canEdit, handleField, toggleBool })}
                        {subTab === "vitals" &&
                            renderVitals({
                                canEdit,
                                recordMeta,
                                vitalBusy,
                                newVital,
                                setNewVital,
                                handleAddVital,
                                vitals,
                                handleDeleteVital,
                            })}
                        {subTab === "drugs" &&
                            renderDrugs({
                                canEdit,
                                recordMeta,
                                drugBusy,
                                newDrug,
                                setNewDrug,
                                handleAddDrug,
                                drugs,
                                handleDeleteDrug,
                            })}
                    </div>
                </SoftCard>

                {/* Mobile sticky save */}
                {canEdit ? (
                    <div className="sticky bottom-0 z-10 md:hidden">
                        <div className="rounded-2xl border border-slate-200 bg-white/85 p-2 backdrop-blur-xl shadow-[0_-10px_25px_rgba(2,6,23,0.06)]">
                            <button
                                type="button"
                                onClick={handleSaveRecord}
                                disabled={saving}
                                className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white shadow-md hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" /> : <Save className="h-4 w-4" />}
                                {saving ? "Saving…" : "Save anaesthesia record"}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

/* ===================== RENDER SECTIONS ===================== */

function renderPreop({ safeRecord, canEdit, handleField, toggleBool, toggleChecklist }) {
    const cl =
        safeRecord.preop_checklist && typeof safeRecord.preop_checklist === "object" ? safeRecord.preop_checklist : {}

    const CHECK_ITEMS = [
        ["consent_taken", "Consent taken"],
        ["npo_confirmed", "NPO confirmed"],
        ["allergy_checked", "Allergy checked"],
        ["investigations_reviewed", "Investigations reviewed"],
        ["airway_evaluated", "Airway evaluated"],
        ["iv_access_secured", "IV access secured"],
        ["monitors_ready", "Monitors ready"],
        ["suction_ready", "Suction ready"],
        ["drugs_ready", "Drugs ready"],
        ["blood_arranged_if_needed", "Blood arranged (if needed)"],
    ]

    const doneCount = CHECK_ITEMS.reduce((n, [k]) => n + (cl?.[k] ? 1 : 0), 0)

    return (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
            {/* Left: quick clinical entries */}
            <div className="space-y-4">
                <SectionCard
                    title="Quick pre-op entry"
                    subtitle="Fill the most used fields first (OT friendly)"
                    icon={LayoutGrid}
                    tone="soft"
                >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                            label="Patient prefix"
                            value={safeRecord.patient_prefix}
                            onChange={(v) => handleField("patient_prefix", v)}
                            options={["", "Mr", "Mrs", "Ms", "Master", "Baby", "Dr"]}
                            disabled={!canEdit}
                        />

                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Select
                                    label="ASA Grade"
                                    value={String(safeRecord.asa_grade ?? "")}
                                    onChange={(v) => handleField("asa_grade", v)}
                                    options={["", "1", "2", "3", "4", "5"]}
                                    disabled={!canEdit}
                                />
                            </div>
                            <div className="pb-2">
                                <Checkbox label="Emergency (E)" checked={!!safeRecord.asa_emergency} onChange={() => toggleBool("asa_emergency")} disabled={!canEdit} />
                            </div>
                        </div>
                    </div>

                    <TextInput label="Diagnosis" placeholder="e.g., Acute appendicitis" value={safeRecord.diagnosis} onChange={(v) => handleField("diagnosis", v)} disabled={!canEdit} />
                    <TextInput label="Proposed operation" placeholder="e.g., Appendicectomy" value={safeRecord.proposed_operation} onChange={(v) => handleField("proposed_operation", v)} disabled={!canEdit} />

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <TextInput label="Weight (kg)" value={safeRecord.weight} onChange={(v) => handleField("weight", v)} disabled={!canEdit} />
                        <TextInput label="Height (cm)" value={safeRecord.height} onChange={(v) => handleField("height", v)} disabled={!canEdit} />
                        <TextInput label="Hb" placeholder="g/dL" value={safeRecord.hb} onChange={(v) => handleField("hb", v)} disabled={!canEdit} />
                        <Select
                            label="Blood group"
                            value={safeRecord.blood_group}
                            onChange={(v) => handleField("blood_group", v)}
                            options={["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
                            disabled={!canEdit}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextInput label="Co-morbidities" placeholder="e.g., DM, HTN" value={safeRecord.comorbidities} onChange={(v) => handleField("comorbidities", v)} disabled={!canEdit} />
                        <TextInput label="Allergies" placeholder="Drug / food / latex" value={safeRecord.allergies} onChange={(v) => handleField("allergies", v)} disabled={!canEdit} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <TextInput label="Pulse" value={safeRecord.preop_pulse} onChange={(v) => handleField("preop_pulse", v)} disabled={!canEdit} />
                        <TextInput label="BP" value={safeRecord.preop_bp} onChange={(v) => handleField("preop_bp", v)} disabled={!canEdit} />
                        <TextInput label="RR" value={safeRecord.preop_rr} onChange={(v) => handleField("preop_rr", v)} disabled={!canEdit} />
                        <TextInput label="Temp (°C)" value={safeRecord.preop_temp_c} onChange={(v) => handleField("preop_temp_c", v)} disabled={!canEdit} />
                    </div>

                    <Select
                        label="Anaesthesia type (planned)"
                        value={safeRecord.anaesthesia_type}
                        onChange={(v) => handleField("anaesthesia_type", v)}
                        options={["", "General", "Regional", "Spinal", "Epidural", "Sedation", "Local", "Combined"]}
                        disabled={!canEdit}
                    />
                    <TextInput label="Airway assessment (summary)" placeholder="e.g., Mouth opening adequate, MP II" value={safeRecord.airway_assessment} onChange={(v) => handleField("airway_assessment", v)} disabled={!canEdit} />
                </SectionCard>

                <SectionCard
                    title="History & investigations"
                    subtitle="Add clinical context (expandable)"
                    icon={ClipboardList}
                    collapsible
                    defaultOpen={false}
                >
                    <Textarea
                        label="History"
                        placeholder="Relevant history / previous anaesthesia / comorbidities summary"
                        value={safeRecord.history}
                        onChange={(v) => handleField("history", v)}
                        disabled={!canEdit}
                    />
                    <Textarea
                        label="Investigation reports"
                        placeholder="Key investigations & findings"
                        value={safeRecord.investigation_reports}
                        onChange={(v) => handleField("investigation_reports", v)}
                        disabled={!canEdit}
                    />
                </SectionCard>

                <SectionCard
                    title="System examination (details)"
                    subtitle="CVS / RS / CNS / PA / Veins / Spine"
                    icon={Activity}
                    collapsible
                    defaultOpen={false}
                >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextInput label="CVS" value={safeRecord.preop_cvs} onChange={(v) => handleField("preop_cvs", v)} disabled={!canEdit} />
                        <TextInput label="RS" value={safeRecord.preop_rs} onChange={(v) => handleField("preop_rs", v)} disabled={!canEdit} />
                        <TextInput label="CNS" value={safeRecord.preop_cns} onChange={(v) => handleField("preop_cns", v)} disabled={!canEdit} />
                        <TextInput label="PA" value={safeRecord.preop_pa} onChange={(v) => handleField("preop_pa", v)} disabled={!canEdit} />
                        <TextInput label="Veins" value={safeRecord.preop_veins} onChange={(v) => handleField("preop_veins", v)} disabled={!canEdit} />
                        <TextInput label="Spine" value={safeRecord.preop_spine} onChange={(v) => handleField("preop_spine", v)} disabled={!canEdit} />
                    </div>
                </SectionCard>
            </div>

            {/* Right: airway/checklist/plan (fast scanning) */}
            <div className="space-y-4">
                <SectionCard title="Airway details" subtitle="Teeth • Denture • Neck • Mallampati" icon={ShieldCheck} tone="soft">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                            label="Teeth"
                            value={safeRecord.airway_teeth_status}
                            onChange={(v) => handleField("airway_teeth_status", v)}
                            options={["", "Intact", "Loose", "Missing", "Not assessed"]}
                            disabled={!canEdit}
                        />
                        <Select
                            label="Denture"
                            value={safeRecord.airway_denture}
                            onChange={(v) => handleField("airway_denture", v)}
                            options={["", "Present", "Absent", "Not assessed"]}
                            disabled={!canEdit}
                        />
                        <Select
                            label="Neck movements"
                            value={safeRecord.airway_neck_movements}
                            onChange={(v) => handleField("airway_neck_movements", v)}
                            options={["", "Normal", "Restricted", "Not assessed"]}
                            disabled={!canEdit}
                        />
                        <Select
                            label="Mallampati"
                            value={safeRecord.airway_mallampati_class}
                            onChange={(v) => handleField("airway_mallampati_class", v)}
                            options={["", "Class I", "Class II", "Class III", "Class IV"]}
                            disabled={!canEdit}
                        />
                    </div>

                    <Checkbox
                        label="Difficult airway anticipated"
                        checked={safeRecord.difficult_airway_anticipated || false}
                        onChange={() => handleField("difficult_airway_anticipated", !safeRecord.difficult_airway_anticipated)}
                        disabled={!canEdit}
                    />
                </SectionCard>

                <SectionCard
                    title="Pre-op checklist (before induction)"
                    subtitle="OT quick check • tap to mark"
                    icon={ListChecks}
                    tone="soft"
                    right={<span className="text-[11px] text-slate-500">{doneCount}/{CHECK_ITEMS.length}</span>}
                >
                    <ProgressBar value={doneCount} max={CHECK_ITEMS.length} />
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {CHECK_ITEMS.map(([key, label]) => (
                            <CheckTile
                                key={key}
                                label={label}
                                checked={!!cl?.[key]}
                                onChange={() => toggleChecklist(key)}
                                disabled={!canEdit}
                            />
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title="Risk & plan" subtitle="Document plan clearly (audit friendly)" icon={FileText} collapsible defaultOpen>
                    <Textarea label="Risk factors" placeholder="e.g., OSA, obesity, full stomach, difficult airway" value={safeRecord.risk_factors} onChange={(v) => handleField("risk_factors", v)} disabled={!canEdit} />
                    <Textarea label="Anaesthetic plan" placeholder="Plan A / Plan B, airway plan, monitoring, analgesia" value={safeRecord.anaesthetic_plan_detail} onChange={(v) => handleField("anaesthetic_plan_detail", v)} disabled={!canEdit} />
                    <Textarea label="Pre-op instructions" placeholder="NPO, meds, consent, blood, post-op plan" value={safeRecord.preop_instructions} onChange={(v) => handleField("preop_instructions", v)} disabled={!canEdit} />
                </SectionCard>
            </div>
        </div>
    )
}

function renderIntraOp(props) {
    const {
        safeRecord,
        canEdit,
        handleField,
        toggleBool,
        toggleLine,
        deviceQ,
        setDeviceQ,
        deviceLoading,
        filteredAirwayMasters,
        filteredMonitorMasters,
        selectedAirwayIds,
        selectedMonitorIds,
        toggleDeviceId,
        airwayMasters,
        monitorMasters,
        toggleLegacyMonitor,
        toggleLegacyAirwayDevice,
    } = props

    const showPosOther = String(safeRecord.patient_position || "") === "Other"
    const showBreathOther = String(safeRecord.breathing_system || "") === "Other"

    return (
        <div className="space-y-4">
            {/* Quick header (always visible) */}
            <SectionCard title="Intra-op header" subtitle="From OT sheet (quick fill)" icon={Timer} tone="soft">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <TextInput label="Date" value={safeRecord.intra_date} onChange={(v) => handleField("intra_date", v)} disabled={!canEdit} placeholder="DD/MM/YYYY" />
                    <TextInput label="Anaesthesiologist" value={safeRecord.intra_anaesthesiologist} onChange={(v) => handleField("intra_anaesthesiologist", v)} disabled={!canEdit} />
                    <TextInput label="Surgeon" value={safeRecord.intra_surgeon} onChange={(v) => handleField("intra_surgeon", v)} disabled={!canEdit} />

                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Elective / Emergency" value={safeRecord.intra_case_type} onChange={(v) => handleField("intra_case_type", v)} options={["", "Elective", "Emergency"]} disabled={!canEdit} />
                        <TextInput label="OR No." value={safeRecord.intra_or_no} onChange={(v) => handleField("intra_or_no", v)} disabled={!canEdit} />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <TextInput label="Surgical procedure" value={safeRecord.intra_surgical_procedure} onChange={(v) => handleField("intra_surgical_procedure", v)} disabled={!canEdit} />
                    <Select label="Type of anaesthesia" value={safeRecord.intra_anaesthesia_type} onChange={(v) => handleField("intra_anaesthesia_type", v)} options={["", "General", "Regional", "MAC"]} disabled={!canEdit} />
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <TextInput label="Anaesthesia start" value={safeRecord.intra_anaesthesia_start} onChange={(v) => handleField("intra_anaesthesia_start", v)} disabled={!canEdit} placeholder="HH:MM" />
                    <TextInput label="Anaesthesia finish" value={safeRecord.intra_anaesthesia_finish} onChange={(v) => handleField("intra_anaesthesia_finish", v)} disabled={!canEdit} placeholder="HH:MM" />
                    <TextInput label="Surgery start" value={safeRecord.intra_surgery_start} onChange={(v) => handleField("intra_surgery_start", v)} disabled={!canEdit} placeholder="HH:MM" />
                    <TextInput label="Surgery finish" value={safeRecord.intra_surgery_finish} onChange={(v) => handleField("intra_surgery_finish", v)} disabled={!canEdit} placeholder="HH:MM" />
                </div>
            </SectionCard>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                {/* Left column */}
                <div className="space-y-4">
                    <SectionCard title="Induction & intubation" subtitle="Airway events" icon={Stethoscope} tone="soft">
                        <div className="flex flex-wrap gap-3">
                            <CheckTileCompact label="Preoxygenation" checked={!!safeRecord.preoxygenation} onChange={() => toggleBool("preoxygenation")} disabled={!canEdit} />
                            <CheckTileCompact label="Cricoid pressure" checked={!!safeRecord.cricoid_pressure} onChange={() => toggleBool("cricoid_pressure")} disabled={!canEdit} />
                        </div>

                        <Select
                            label="Induction"
                            value={safeRecord.induction_route}
                            onChange={(v) => handleField("induction_route", v)}
                            options={["", "Intravenous", "Inhalational", "Rapid sequence"]}
                            disabled={!canEdit}
                        />

                        <CheckTileCompact label="Intubation done" checked={!!safeRecord.intubation_done} onChange={() => toggleBool("intubation_done")} disabled={!canEdit} />

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Select label="Route" value={safeRecord.intubation_route} onChange={(v) => handleField("intubation_route", v)} options={["", "Oral", "Nasal"]} disabled={!canEdit} />
                            <Select label="State" value={safeRecord.intubation_state} onChange={(v) => handleField("intubation_state", v)} options={["", "Awake", "Anaesthetised"]} disabled={!canEdit} />
                            <Select
                                label="Technique"
                                value={safeRecord.intubation_technique}
                                onChange={(v) => handleField("intubation_technique", v)}
                                options={["", "Visual", "Blind", "Fibreoptic - aided", "Retrograde"]}
                                disabled={!canEdit}
                            />
                            <Select
                                label="Laryngoscopic view"
                                value={safeRecord.laryngoscopy_grade}
                                onChange={(v) => handleField("laryngoscopy_grade", v)}
                                options={["", "Grade I", "Grade II", "Grade III", "Grade IV"]}
                                disabled={!canEdit}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <TextInput label="Tube type" value={safeRecord.tube_type} onChange={(v) => handleField("tube_type", v)} disabled={!canEdit} />
                            <TextInput label="Size" value={safeRecord.tube_size} onChange={(v) => handleField("tube_size", v)} disabled={!canEdit} />
                            <TextInput label="Fixed at" value={safeRecord.tube_fixed_at} onChange={(v) => handleField("tube_fixed_at", v)} disabled={!canEdit} />
                            <Select label="If cuff yes - inflated with" value={safeRecord.cuff_medium} onChange={(v) => handleField("cuff_medium", v)} options={["", "Air", "Saline", "Not inflated"]} disabled={!canEdit} />
                        </div>

                        <CheckTileCompact label="Cuff used" checked={!!safeRecord.cuff_used} onChange={() => toggleBool("cuff_used")} disabled={!canEdit} />

                        <TextInput label="Bilateral breath sounds" value={safeRecord.bilateral_breath_sounds} onChange={(v) => handleField("bilateral_breath_sounds", v)} disabled={!canEdit} />
                        <TextInput label="Added sounds" value={safeRecord.added_sounds} onChange={(v) => handleField("added_sounds", v)} disabled={!canEdit} />
                    </SectionCard>

                    <SectionCard title="Ventilation • Position • Lines" subtitle="Core intra-op setup" icon={AirVent} collapsible defaultOpen>
                        <Select
                            label="Ventilation"
                            value={safeRecord.ventilation_mode_baseline}
                            onChange={(v) => handleField("ventilation_mode_baseline", v)}
                            options={["", "Spontaneous", "Controlled", "Manual", "Ventilator"]}
                            disabled={!canEdit}
                        />

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <TextInput label="Vt (ml)" value={safeRecord.ventilator_vt} onChange={(v) => handleField("ventilator_vt", v)} disabled={!canEdit} />
                            <TextInput label="Rate (f)" value={safeRecord.ventilator_rate} onChange={(v) => handleField("ventilator_rate", v)} disabled={!canEdit} />
                            <TextInput label="PEEP (cmH₂O)" value={safeRecord.ventilator_peep} onChange={(v) => handleField("ventilator_peep", v)} disabled={!canEdit} />
                        </div>

                        <Select
                            label="Breathing system"
                            value={safeRecord.breathing_system}
                            onChange={(v) => handleField("breathing_system", v)}
                            options={["", "Mapleson A", "Mapleson D", "Mapleson F", "Circle system", "Other"]}
                            disabled={!canEdit}
                        />
                        {showBreathOther ? (
                            <TextInput label="Breathing system (Other specify)" value={safeRecord.breathing_system_other} onChange={(v) => handleField("breathing_system_other", v)} disabled={!canEdit} />
                        ) : null}

                        <div className="mt-1 text-[11px] font-semibold text-slate-600">Position & protection</div>
                        <Select
                            label="Patient position"
                            value={safeRecord.patient_position}
                            onChange={(v) => handleField("patient_position", v)}
                            options={["", "Supine", "Lateral", "Prone", "Lithotomy", "Other"]}
                            disabled={!canEdit}
                        />
                        {showPosOther ? (
                            <TextInput label="Position (Other specify)" value={safeRecord.patient_position_other} onChange={(v) => handleField("patient_position_other", v)} disabled={!canEdit} />
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                            <CheckTileCompact label="Eyes taped" checked={!!safeRecord.eyes_taped} onChange={() => toggleBool("eyes_taped")} disabled={!canEdit} />
                            <CheckTileCompact label="Eyes covered with foil" checked={!!safeRecord.eyes_covered_with_foil} onChange={() => toggleBool("eyes_covered_with_foil")} disabled={!canEdit} />
                            <CheckTileCompact label="Pressure points padded" checked={!!safeRecord.pressure_points_padded} onChange={() => toggleBool("pressure_points_padded")} disabled={!canEdit} />
                        </div>

                        <div className="mt-2 text-[11px] font-semibold text-slate-600">Lines & tourniquet</div>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                ["peripheral_iv", "Peripheral IV"],
                                ["central_line", "Central line"],
                                ["arterial_line", "Arterial line"],
                            ].map(([key, label]) => (
                                <CheckTileCompact key={key} label={label} checked={!!safeRecord.lines?.[key]} onChange={() => toggleLine(key)} disabled={!canEdit} />
                            ))}
                        </div>

                        <CheckTileCompact label="Tourniquet used" checked={!!safeRecord.tourniquet_used} onChange={() => toggleBool("tourniquet_used")} disabled={!canEdit} />
                        <TextInput label="Tourniquet details" value={safeRecord.tourniquet_details} onChange={(v) => handleField("tourniquet_details", v)} disabled={!canEdit} placeholder="Site / duration / pressure" />
                        <Textarea label="Lines (notes)" value={safeRecord.lines_notes} onChange={(v) => handleField("lines_notes", v)} disabled={!canEdit} placeholder="Paper has a free box for Lines" />
                    </SectionCard>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                    <SectionCard title="Devices & monitors" subtitle="Master list (search + quick selection)" icon={Monitor} tone="soft">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-[12px] text-slate-600">{deviceLoading ? "Loading devices…" : "Select from master lists"}</div>

                            <div className="relative w-full sm:w-[260px]">
                                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-9 text-[12px] text-slate-900 outline-none transition focus:border-slate-300"
                                    placeholder="Search devices…"
                                    value={deviceQ}
                                    onChange={(e) => setDeviceQ(e.target.value)}
                                />
                            </div>
                        </div>

                        <SoftInset title="Airway devices (Master)" right={deviceLoading ? "Loading…" : `${selectedAirwayIds.length} selected`}>
                            {filteredAirwayMasters.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {filteredAirwayMasters.map((d) => (
                                        <CheckTile
                                            key={d.id}
                                            label={d.name}
                                            checked={selectedAirwayIds.includes(d.id)}
                                            onChange={() => toggleDeviceId("airway_device_ids", d.id)}
                                            disabled={!canEdit}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[12px] text-slate-600">No master airway devices found. (Legacy fallback below)</div>
                            )}
                        </SoftInset>

                        <SoftInset title="Monitors (Master)" right={deviceLoading ? "Loading…" : `${selectedMonitorIds.length} selected`}>
                            {filteredMonitorMasters.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {filteredMonitorMasters.map((d) => (
                                        <CheckTile
                                            key={d.id}
                                            label={d.name}
                                            checked={selectedMonitorIds.includes(d.id)}
                                            onChange={() => toggleDeviceId("monitor_device_ids", d.id)}
                                            disabled={!canEdit}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[12px] text-slate-600">No master monitor devices found. (Legacy fallback below)</div>
                            )}
                        </SoftInset>

                        {(airwayMasters.length === 0 || monitorMasters.length === 0) && (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                                <div className="text-[11px] font-semibold text-slate-700">Legacy fallback (optional)</div>

                                <div className="mt-2 text-[11px] font-semibold text-slate-600">Airway devices</div>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                    {["Face mask", "LMA/ILMA", "Tracheostomy", "Oral airway", "Throat pack", "NG tube", "Other"].map((label) => (
                                        <CheckTileCompact
                                            key={label}
                                            label={label}
                                            checked={(safeRecord.airway_devices || []).includes(label)}
                                            onChange={() => toggleLegacyAirwayDevice(label)}
                                            disabled={!canEdit}
                                        />
                                    ))}
                                </div>

                                <div className="mt-3 text-[11px] font-semibold text-slate-600">Monitors</div>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                    {[
                                        ["ecg", "ECG"],
                                        ["nibp", "NIBP"],
                                        ["pulse_oximeter", "Pulse oximeter"],
                                        ["capnograph", "Capnograph"],
                                        ["agent_monitor", "Agent monitor"],
                                        ["pns", "PNS"],
                                        ["temperature", "Temperature"],
                                        ["urinary_catheter", "Urinary catheter"],
                                        ["ibp", "IBP"],
                                        ["cvp", "CVP"],
                                        ["precordial_steth", "Precordial steth"],
                                        ["oesophageal_steth", "Oesophageal steth"],
                                    ].map(([key, label]) => (
                                        <CheckTileCompact key={key} label={label} checked={!!safeRecord.monitors?.[key]} onChange={() => toggleLegacyMonitor(key)} disabled={!canEdit} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard title="Fluids • Blood • Antibiotics • Totals" subtitle="Paper boxes (audit ready)" icon={Droplet} collapsible defaultOpen={false}>
                        <Textarea label="IV fluids (plan)" value={safeRecord.iv_fluids_plan} onChange={(v) => handleField("iv_fluids_plan", v)} disabled={!canEdit} />
                        <Textarea label="IV fluids (given)" value={safeRecord.iv_fluids_given} onChange={(v) => handleField("iv_fluids_given", v)} disabled={!canEdit} placeholder="Paper ‘IV Fluids’ box" />
                        <Textarea label="Blood & components (plan)" value={safeRecord.blood_components_plan} onChange={(v) => handleField("blood_components_plan", v)} disabled={!canEdit} />
                        <Textarea label="Blood & components (given)" value={safeRecord.blood_components_given} onChange={(v) => handleField("blood_components_given", v)} disabled={!canEdit} placeholder="Paper ‘Blood & Blood Components’ box" />
                        <Textarea label="Antibiotics given" value={safeRecord.antibiotics_given} onChange={(v) => handleField("antibiotics_given", v)} disabled={!canEdit} placeholder="Paper ‘Antibiotics given’ box" />
                        <div className="grid grid-cols-2 gap-3">
                            <TextInput label="Total input (ml)" value={safeRecord.total_input_ml} onChange={(v) => handleField("total_input_ml", v)} disabled={!canEdit} />
                            <TextInput label="Total output (ml)" value={safeRecord.total_output_ml} onChange={(v) => handleField("total_output_ml", v)} disabled={!canEdit} />
                        </div>
                    </SectionCard>

                    <SectionCard title="Regional block" subtitle="Fill if applicable" icon={ShieldCheck} collapsible defaultOpen={false}>
                        <Select label="Type" value={safeRecord.regional_block_type} onChange={(v) => handleField("regional_block_type", v)} options={["", "Spinal", "Epidural", "Nerve block", "Combined", "None"]} disabled={!canEdit} />
                        <TextInput label="Position" value={safeRecord.regional_position} onChange={(v) => handleField("regional_position", v)} disabled={!canEdit} />
                        <TextInput label="Approach" value={safeRecord.regional_approach} onChange={(v) => handleField("regional_approach", v)} disabled={!canEdit} />
                        <TextInput label="Space & depth" value={safeRecord.regional_space_depth} onChange={(v) => handleField("regional_space_depth", v)} disabled={!canEdit} />
                        <TextInput label="Needle type" value={safeRecord.regional_needle_type} onChange={(v) => handleField("regional_needle_type", v)} disabled={!canEdit} />
                        <TextInput label="Drug injected / dose" value={safeRecord.regional_drug_dose} onChange={(v) => handleField("regional_drug_dose", v)} disabled={!canEdit} />
                        <TextInput label="Level of anaesthesia" value={safeRecord.regional_level} onChange={(v) => handleField("regional_level", v)} disabled={!canEdit} />
                        <TextInput label="Complications" value={safeRecord.regional_complications} onChange={(v) => handleField("regional_complications", v)} disabled={!canEdit} />
                        <Select label="Adequacy of block" value={safeRecord.block_adequacy} onChange={(v) => handleField("block_adequacy", v)} options={["", "Excellent", "Adequate", "Poor"]} disabled={!canEdit} />
                        <div className="flex flex-wrap gap-2">
                            <CheckTileCompact label="Sedation needed" checked={!!safeRecord.sedation_needed} onChange={() => toggleBool("sedation_needed")} disabled={!canEdit} />
                            <CheckTileCompact label="Conversion to GA" checked={!!safeRecord.conversion_to_ga} onChange={() => toggleBool("conversion_to_ga")} disabled={!canEdit} />
                        </div>
                    </SectionCard>
                </div>
            </div>

            <SectionCard title="Intra-op summary / notes" subtitle="Free text (as on paper)" icon={FileText} collapsible defaultOpen={false}>
                <Textarea label="Notes" value={safeRecord.notes || ""} onChange={(v) => handleField("notes", v)} disabled={!canEdit} />
            </SectionCard>
        </div>
    )
}

function renderPostop({ safeRecord, canEdit, handleField, toggleBool }) {
    return (
        <div className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
            <SectionCard title="Post-op recovery (PACU / ICU / Ward)" subtitle="Quick nursing/doctor view" icon={ShieldCheck} tone="soft">
                <Select label="Destination" value={safeRecord.postop_destination} onChange={(v) => handleField("postop_destination", v)} options={["", "PACU", "ICU", "Ward"]} disabled={!canEdit} />

                <div className="flex flex-wrap gap-3">
                    <CheckTileCompact label="Extubated" checked={!!safeRecord.postop_extubated} onChange={() => toggleBool("postop_extubated")} disabled={!canEdit} />
                    <TextInput label="Extubation time (HH:MM)" value={safeRecord.postop_extubation_time} onChange={(v) => handleField("postop_extubation_time", v)} disabled={!canEdit} />
                </div>

                <div className="flex flex-wrap gap-3">
                    <CheckTileCompact label="Reversal given" checked={!!safeRecord.postop_reversal_given} onChange={() => toggleBool("postop_reversal_given")} disabled={!canEdit} />
                    <TextInput label="Reversal drugs" value={safeRecord.postop_reversal_drugs} onChange={(v) => handleField("postop_reversal_drugs", v)} disabled={!canEdit} placeholder="e.g., Neostigmine + Glyco" />
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <TextInput label="BP" value={safeRecord.postop_bp} onChange={(v) => handleField("postop_bp", v)} disabled={!canEdit} />
                    <TextInput label="HR" value={safeRecord.postop_hr} onChange={(v) => handleField("postop_hr", v)} disabled={!canEdit} />
                    <TextInput label="SpO₂" value={safeRecord.postop_spo2} onChange={(v) => handleField("postop_spo2", v)} disabled={!canEdit} />
                    <TextInput label="RR" value={safeRecord.postop_rr} onChange={(v) => handleField("postop_rr", v)} disabled={!canEdit} />
                    <TextInput label="Temp °C" value={safeRecord.postop_temp_c} onChange={(v) => handleField("postop_temp_c", v)} disabled={!canEdit} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <TextInput label="Pain score" value={safeRecord.postop_pain_score} onChange={(v) => handleField("postop_pain_score", v)} disabled={!canEdit} placeholder="0–10" />
                    <TextInput label="N/V" value={safeRecord.postop_nausea_vomiting} onChange={(v) => handleField("postop_nausea_vomiting", v)} disabled={!canEdit} placeholder="None / Mild / Severe" />
                </div>

                <Textarea label="Complications (post-op)" value={safeRecord.postop_complications} onChange={(v) => handleField("postop_complications", v)} disabled={!canEdit} />
                <Textarea label="Post-op notes / orders" value={safeRecord.postop_notes} onChange={(v) => handleField("postop_notes", v)} disabled={!canEdit} />
            </SectionCard>

            <SectionCard title="Quick summary" subtitle="Fast scan without scrolling" icon={Activity}>
                <SoftNotice>
                    Tip: Post-op is separated so nurses/doctors can quickly find recovery details without scrolling inside intra-op.
                </SoftNotice>

                <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-700">
                    <Mini label="Destination" value={safeRecord.postop_destination || "—"} />
                    <Mini label="Extubation" value={safeRecord.postop_extubation_time || "—"} />
                    <Mini label="BP" value={safeRecord.postop_bp || "—"} />
                    <Mini label="HR" value={safeRecord.postop_hr || "—"} />
                    <Mini label="SpO₂" value={safeRecord.postop_spo2 || "—"} />
                    <Mini label="Temp" value={safeRecord.postop_temp_c || "—"} />
                    <Mini label="Pain" value={safeRecord.postop_pain_score || "—"} />
                    <Mini label="N/V" value={safeRecord.postop_nausea_vomiting || "—"} />
                </div>
            </SectionCard>
        </div>
    )
}

function renderVitals({ canEdit, recordMeta, vitalBusy, newVital, setNewVital, handleAddVital, vitals, handleDeleteVital }) {
    return (
        <div className="space-y-4">
            {!recordMeta.id ? <SoftNotice>Save the anaesthesia record first to enable vitals logging.</SoftNotice> : null}

            <SectionCard title="Auto intra-op chart (paper style)" subtitle="Auto-generated from vitals" icon={Activity} tone="soft">
                <AnaesthesiaPaperChart vitals={vitals} />
                <div className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                    Symbols: Sys BP = <b>V</b> • Dia BP = <b>^</b> • HR = <b>•</b> • Temp = <b>△</b> • RR = <b>O</b>
                </div>
            </SectionCard>

            <SectionCard title="Add vitals (quick row)" subtitle="Use HH:MM for time (OT-friendly entry)" icon={Activity} tone="soft">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                    <TextInput label="Time (HH:MM)" value={newVital.time} onChange={(v) => setNewVital((p) => ({ ...p, time: v }))} disabled={!canEdit || !recordMeta.id} placeholder="09:10" />
                    <TextInput label="HR" value={newVital.hr} onChange={(v) => setNewVital((p) => ({ ...p, hr: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="BP" value={newVital.bp} onChange={(v) => setNewVital((p) => ({ ...p, bp: v }))} disabled={!canEdit || !recordMeta.id} placeholder="120/80" />
                    <TextInput label="SpO₂" value={newVital.spo2} onChange={(v) => setNewVital((p) => ({ ...p, spo2: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="RR" value={newVital.rr} onChange={(v) => setNewVital((p) => ({ ...p, rr: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="Temp °C" value={newVital.temp_c} onChange={(v) => setNewVital((p) => ({ ...p, temp_c: v }))} disabled={!canEdit || !recordMeta.id} />
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                    <TextInput label="ETCO₂" value={newVital.etco2} onChange={(v) => setNewVital((p) => ({ ...p, etco2: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="Vent mode" value={newVital.ventilation_mode} onChange={(v) => setNewVital((p) => ({ ...p, ventilation_mode: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="Peak P" value={newVital.peak_airway_pressure} onChange={(v) => setNewVital((p) => ({ ...p, peak_airway_pressure: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="CVP/PCWP" value={newVital.cvp_pcwp} onChange={(v) => setNewVital((p) => ({ ...p, cvp_pcwp: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="Urine (ml)" value={newVital.urine_output_ml} onChange={(v) => setNewVital((p) => ({ ...p, urine_output_ml: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="Blood loss (ml)" value={newVital.blood_loss_ml} onChange={(v) => setNewVital((p) => ({ ...p, blood_loss_ml: v }))} disabled={!canEdit || !recordMeta.id} />
                </div>

                {/* ✅ Paper gas chart row (Advanced, optional) */}
                <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-[12px] font-semibold text-slate-700">Advanced (Gas / Fluids row from paper chart)</summary>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                        <TextInput label="Oxygen/FiO₂" value={newVital.oxygen_fio2} onChange={(v) => setNewVital((p) => ({ ...p, oxygen_fio2: v }))} disabled={!canEdit || !recordMeta.id} placeholder="e.g., 50% / 2L" />
                        <TextInput label="N₂O" value={newVital.n2o} onChange={(v) => setNewVital((p) => ({ ...p, n2o: v }))} disabled={!canEdit || !recordMeta.id} />
                        <TextInput label="Air" value={newVital.air} onChange={(v) => setNewVital((p) => ({ ...p, air: v }))} disabled={!canEdit || !recordMeta.id} />
                        <TextInput label="Agent (Halo/ISO/Sevo)" value={newVital.agent} onChange={(v) => setNewVital((p) => ({ ...p, agent: v }))} disabled={!canEdit || !recordMeta.id} />
                        <TextInput label="IV Fluids (at time)" value={newVital.iv_fluids} onChange={(v) => setNewVital((p) => ({ ...p, iv_fluids: v }))} disabled={!canEdit || !recordMeta.id} placeholder="e.g., RL 200ml" />
                    </div>
                </details>

                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                    <div className="flex-1">
                        <TextInput label="Comments" value={newVital.comments} onChange={(v) => setNewVital((p) => ({ ...p, comments: v }))} disabled={!canEdit || !recordMeta.id} />
                    </div>

                    {canEdit ? (
                        <button
                            type="button"
                            onClick={handleAddVital}
                            disabled={vitalBusy || !recordMeta.id}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-[12px] font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {vitalBusy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-b-transparent" /> : null}
                            {vitalBusy ? "Adding…" : "Add vitals"}
                        </button>
                    ) : null}
                </div>
            </SectionCard>

            {/* Desktop table */}
            <div className="hidden md:block">
                <SectionCard title="Vitals log" subtitle="Scrollable table" icon={Activity} collapsible defaultOpen>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-[12px]">
                            <thead className="sticky top-0 bg-slate-50 text-slate-600">
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
                                    <Th>O₂/FiO₂</Th>
                                    <Th>N₂O</Th>
                                    <Th>Air</Th>
                                    <Th>Agent</Th>
                                    <Th>IV Fluids</Th>
                                    <Th>Comments</Th>
                                    <Th></Th>
                                </tr>
                            </thead>
                            <tbody>
                                {vitals.length === 0 ? (
                                    <tr>
                                        <td colSpan={19} className="py-4 text-center text-slate-500">
                                            No vitals logged yet.
                                        </td>
                                    </tr>
                                ) : (
                                    vitals.map((v, idx) => (
                                        <tr key={v.id} className={"border-t " + (idx % 2 ? "bg-white" : "bg-slate-50/30")}>
                                            <Td>{formatHHMM(v.time)}</Td>
                                            <Td>{v.hr ?? "—"}</Td>
                                            <Td>{v.bp ?? "—"}</Td>
                                            <Td>{v.spo2 ?? "—"}</Td>
                                            <Td>{v.rr ?? "—"}</Td>
                                            <Td>{v.temp_c ?? "—"}</Td>
                                            <Td>{v.etco2 ?? "—"}</Td>
                                            <Td>{v.ventilation_mode ?? "—"}</Td>
                                            <Td>{v.peak_airway_pressure ?? "—"}</Td>
                                            <Td>{v.cvp_pcwp ?? "—"}</Td>
                                            <Td>{v.urine_output_ml ?? "—"}</Td>
                                            <Td>{v.blood_loss_ml ?? "—"}</Td>
                                            <Td>{v.oxygen_fio2 ?? "—"}</Td>
                                            <Td>{v.n2o ?? "—"}</Td>
                                            <Td>{v.air ?? "—"}</Td>
                                            <Td>{v.agent ?? "—"}</Td>
                                            <Td>{v.iv_fluids ?? "—"}</Td>
                                            <Td className="max-w-[280px] truncate">{v.comments ?? "—"}</Td>
                                            <Td>
                                                {canEdit ? (
                                                    <button onClick={() => handleDeleteVital(v.id)} className="text-[12px] font-semibold text-rose-600 hover:underline">
                                                        Delete
                                                    </button>
                                                ) : null}
                                            </Td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2">
                {vitals.length === 0 ? (
                    <SoftNotice>No vitals logged yet.</SoftNotice>
                ) : (
                    vitals.map((v) => (
                        <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="text-[13px] font-semibold text-slate-900">{formatHHMM(v.time)}</div>
                                {canEdit ? (
                                    <button onClick={() => handleDeleteVital(v.id)} className="text-[12px] font-semibold text-rose-600">
                                        Delete
                                    </button>
                                ) : null}
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-slate-700">
                                <Mini label="HR" value={v.hr} />
                                <Mini label="BP" value={v.bp} />
                                <Mini label="SpO₂" value={v.spo2} />
                                <Mini label="RR" value={v.rr} />
                                <Mini label="Temp" value={v.temp_c} />
                                <Mini label="ETCO₂" value={v.etco2} />
                                <Mini label="Vent" value={v.ventilation_mode} />
                                <Mini label="Peak P" value={v.peak_airway_pressure} />
                                <Mini label="CVP/PCWP" value={v.cvp_pcwp} />
                                <Mini label="Urine" value={v.urine_output_ml} />
                                <Mini label="Blood loss" value={v.blood_loss_ml} />
                                <Mini label="Agent" value={v.agent} />
                            </div>

                            {v.oxygen_fio2 || v.n2o || v.air || v.iv_fluids ? (
                                <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                                    <div className="font-semibold text-slate-600">Gas/Fluids:</div>
                                    <div className="mt-1">
                                        O₂/FiO₂: {v.oxygen_fio2 || "—"} • N₂O: {v.n2o || "—"} • Air: {v.air || "—"} • IV: {v.iv_fluids || "—"}
                                    </div>
                                </div>
                            ) : null}

                            {v.comments ? (
                                <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                                    <span className="font-semibold text-slate-600">Comments:</span> {v.comments}
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function renderDrugs({ canEdit, recordMeta, drugBusy, newDrug, setNewDrug, handleAddDrug, drugs, handleDeleteDrug }) {
    return (
        <div className="space-y-4">
            {!recordMeta.id ? <SoftNotice>Save the anaesthesia record first to enable drug logging.</SoftNotice> : null}

            <SectionCard title="Add drug (quick row)" subtitle="Fast entry during OT" icon={Syringe} tone="soft">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <TextInput label="Time (HH:MM)" value={newDrug.time} onChange={(v) => setNewDrug((p) => ({ ...p, time: v }))} disabled={!canEdit || !recordMeta.id} placeholder="09:15" />
                    <TextInput label="Drug name" value={newDrug.drug_name} onChange={(v) => setNewDrug((p) => ({ ...p, drug_name: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="Dose" value={newDrug.dose} onChange={(v) => setNewDrug((p) => ({ ...p, dose: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="Route" value={newDrug.route} onChange={(v) => setNewDrug((p) => ({ ...p, route: v }))} disabled={!canEdit || !recordMeta.id} />
                    <TextInput label="Remarks" value={newDrug.remarks} onChange={(v) => setNewDrug((p) => ({ ...p, remarks: v }))} disabled={!canEdit || !recordMeta.id} />
                </div>

                {canEdit ? (
                    <button
                        type="button"
                        onClick={handleAddDrug}
                        disabled={drugBusy || !recordMeta.id}
                        className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-[12px] font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {drugBusy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-b-transparent" /> : null}
                        {drugBusy ? "Adding…" : "Add drug"}
                    </button>
                ) : null}
            </SectionCard>

            <div className="hidden md:block">
                <SectionCard title="Drug log" subtitle="Table view" icon={Syringe} collapsible defaultOpen>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-[12px]">
                            <thead className="sticky top-0 bg-slate-50 text-slate-600">
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
                                        <td colSpan={6} className="py-4 text-center text-slate-500">
                                            No drugs logged yet.
                                        </td>
                                    </tr>
                                ) : (
                                    drugs.map((d, idx) => (
                                        <tr key={d.id} className={"border-t " + (idx % 2 ? "bg-white" : "bg-slate-50/30")}>
                                            <Td>{formatHHMM(d.time)}</Td>
                                            <Td className="font-medium text-slate-900">{d.drug_name ?? "—"}</Td>
                                            <Td>{d.dose ?? "—"}</Td>
                                            <Td>{d.route ?? "—"}</Td>
                                            <Td className="max-w-[360px] truncate">{d.remarks ?? "—"}</Td>
                                            <Td>
                                                {canEdit ? (
                                                    <button onClick={() => handleDeleteDrug(d.id)} className="text-[12px] font-semibold text-rose-600 hover:underline">
                                                        Delete
                                                    </button>
                                                ) : null}
                                            </Td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            </div>

            <div className="md:hidden space-y-2">
                {drugs.length === 0 ? (
                    <SoftNotice>No drugs logged yet.</SoftNotice>
                ) : (
                    drugs.map((d) => (
                        <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-[13px] font-semibold text-slate-900">{d.drug_name || "—"}</div>
                                    <div className="mt-0.5 text-[12px] text-slate-500">
                                        {formatHHMM(d.time)} • {d.route || "Route —"}
                                    </div>
                                </div>
                                {canEdit ? (
                                    <button onClick={() => handleDeleteDrug(d.id)} className="shrink-0 text-[12px] font-semibold text-rose-600">
                                        Delete
                                    </button>
                                ) : null}
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-slate-700">
                                <Mini label="Dose" value={d.dose} />
                                <Mini label="Route" value={d.route} />
                            </div>

                            {d.remarks ? (
                                <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                                    <span className="font-semibold text-slate-600">Remarks:</span> {d.remarks}
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

/* ===================== AUTO GRAPH (SVG PAPER STYLE) ===================== */
function AnaesthesiaPaperChart({ vitals }) {
    const pts = useMemo(() => {
        const arr = Array.isArray(vitals) ? vitals : []
        const norm = arr
            .map((v) => {
                const t = formatHHMM(v.time)
                const tm = parseHHMMToMinutes(t)
                const { sys, dia } = parseBp(v.bp)
                return {
                    id: v.id ?? `${t}-${Math.random()}`,
                    t,
                    tm,
                    hr: v.hr ?? null,
                    sys,
                    dia,
                    rr: v.rr ?? null,
                    temp: v.temp_c ?? null,
                }
            })
            .filter((x) => x.tm !== null)
            .sort((a, b) => a.tm - b.tm)
        return norm
    }, [vitals])

    if (!pts.length) {
        return <div className="text-[12px] text-slate-600">No vitals yet. Add vitals and the chart will auto-generate.</div>
    }

    const W = 1200
    const H = 360
    const margin = { l: 70, r: 20, t: 20, b: 40 }
    const cw = W - margin.l - margin.r
    const ch = H - margin.t - margin.b

    const yMin = 20
    const yMax = 240

    const n = pts.length
    const x = (i) => margin.l + (n === 1 ? 0 : (cw * i) / (n - 1))

    const yBP = (v) => {
        if (v === null || v === undefined) return null
        const vv = Number(v)
        if (Number.isNaN(vv)) return null
        const clamped = Math.max(yMin, Math.min(yMax, vv))
        const p = (clamped - yMin) / (yMax - yMin)
        return margin.t + ch * (1 - p)
    }

    const yTempToBP = (temp) => {
        const v = Number(temp)
        if (Number.isNaN(v)) return null
        const tMin = 28
        const tMax = 40
        const clamped = Math.max(tMin, Math.min(tMax, v))
        const p = (clamped - tMin) / (tMax - tMin)
        return margin.t + ch * (1 - p)
    }

    const yRRToBP = (rr) => {
        const v = Number(rr)
        if (Number.isNaN(v)) return null
        const rMin = 10
        const rMax = 40
        const clamped = Math.max(rMin, Math.min(rMax, v))
        const p = (clamped - rMin) / (rMax - rMin)
        return margin.t + ch * (1 - p)
    }

    const buildPath = (getter) => {
        let d = ""
        pts.forEach((p, i) => {
            const y = getter(p)
            if (y === null) return
            const xi = x(i)
            d += d ? ` L ${xi} ${y}` : `M ${xi} ${y}`
        })
        return d || null
    }

    const sysPath = buildPath((p) => yBP(p.sys))
    const diaPath = buildPath((p) => yBP(p.dia))
    const hrPath = buildPath((p) => yBP(p.hr))
    const tempPath = buildPath((p) => yTempToBP(p.temp))
    const rrPath = buildPath((p) => yRRToBP(p.rr))

    const yTicks = []
    for (let v = 20; v <= 240; v += 20) yTicks.push(v)

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-[980px]">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                    <rect x="1" y="1" width={W - 2} height={H - 2} fill="white" stroke="currentColor" strokeOpacity="0.25" />

                    {yTicks.map((v) => {
                        const yy = yBP(v)
                        return (
                            <g key={`y-${v}`}>
                                <line x1={margin.l} y1={yy} x2={W - margin.r} y2={yy} stroke="currentColor" strokeOpacity={v % 40 === 0 ? 0.18 : 0.1} />
                                {v % 40 === 0 ? (
                                    <text x={10} y={yy + 4} fontSize="12" fill="currentColor" fillOpacity="0.65">
                                        {v}
                                    </text>
                                ) : null}
                            </g>
                        )
                    })}

                    {pts.map((p, i) => (
                        <line key={`x-${p.id}`} x1={x(i)} y1={margin.t} x2={x(i)} y2={H - margin.b} stroke="currentColor" strokeOpacity={i % 4 === 0 ? 0.16 : 0.08} />
                    ))}

                    <text x={margin.l} y={H - 12} fontSize="12" fill="currentColor" fillOpacity="0.75">
                        Time →
                    </text>

                    {pts.map((p, i) => (
                        <text key={`t-${p.id}`} x={x(i)} y={H - 18} fontSize="11" textAnchor="middle" fill="currentColor" fillOpacity="0.65">
                            {p.t}
                        </text>
                    ))}

                    {sysPath ? <path d={sysPath} fill="none" stroke="currentColor" strokeWidth="2" /> : null}
                    {diaPath ? <path d={diaPath} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" /> : null}
                    {hrPath ? <path d={hrPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.75" /> : null}
                    {tempPath ? <path d={tempPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.55" strokeDasharray="3 3" /> : null}
                    {rrPath ? <path d={rrPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeDasharray="2 4" /> : null}

                    {pts.map((p, i) => {
                        const xi = x(i)
                        const ys = yBP(p.sys)
                        const yd = yBP(p.dia)
                        const yh = yBP(p.hr)
                        const yt = yTempToBP(p.temp)
                        const yr = yRRToBP(p.rr)
                        return (
                            <g key={`m-${p.id}`}>
                                {ys !== null ? (
                                    <text x={xi} y={ys + 5} fontSize="14" textAnchor="middle" fill="currentColor">
                                        V
                                    </text>
                                ) : null}
                                {yd !== null ? (
                                    <text x={xi} y={yd + 5} fontSize="14" textAnchor="middle" fill="currentColor">
                                        ^
                                    </text>
                                ) : null}
                                {yh !== null ? <circle cx={xi} cy={yh} r="3.2" fill="currentColor" /> : null}
                                {yt !== null ? (
                                    <text x={xi} y={yt + 5} fontSize="13" textAnchor="middle" fill="currentColor" fillOpacity="0.8">
                                        △
                                    </text>
                                ) : null}
                                {yr !== null ? (
                                    <text x={xi} y={yr + 5} fontSize="13" textAnchor="middle" fill="currentColor" fillOpacity="0.75">
                                        O
                                    </text>
                                ) : null}
                            </g>
                        )
                    })}

                    <g>
                        <rect x={W - 290} y={12} width={270} height={56} fill="white" stroke="currentColor" strokeOpacity="0.18" />
                        <text x={W - 275} y={32} fontSize="12" fill="currentColor" fillOpacity="0.8">
                            Sys BP: V   Dia BP: ^   HR: •
                        </text>
                        <text x={W - 275} y={52} fontSize="12" fill="currentColor" fillOpacity="0.7">
                            Temp: △ (28–40 mapped)   RR: O (10–40 mapped)
                        </text>
                    </g>
                </svg>
            </div>
        </div>
    )
}

/* ===================== UI PRIMITIVES (Redesigned) ===================== */

function SoftCard({ children, className = "" }) {
    return (
        <div
            className={
                "rounded-[26px] border border-slate-200 bg-white/80 backdrop-blur-xl shadow-[0_14px_40px_rgba(2,6,23,0.10)] " +
                className
            }
        >
            {children}
        </div>
    )
}

function Pill({ tone = "slate", icon: Icon, children }) {
    const map = {
        slate: "bg-slate-100 text-slate-700",
        emerald: "bg-emerald-50 text-emerald-700",
        sky: "bg-sky-50 text-sky-700",
        amber: "bg-amber-50 text-amber-700",
        rose: "bg-rose-50 text-rose-700",
        indigo: "bg-indigo-50 text-indigo-700",
    }
    return (
        <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold " + (map[tone] || map.slate)}>
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {children}
        </span>
    )
}

function Chip({ icon: Icon, children }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[12px] font-medium text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.05)]">
            {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
            {children}
        </span>
    )
}

function ActionButton({ onClick, disabled, icon: Icon, label, busy, variant = "outline" }) {
    const base =
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
    const styles =
        variant === "solid"
            ? "bg-slate-900 text-white hover:bg-black"
            : variant === "dark"
                ? "bg-black text-white hover:bg-slate-900"
                : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"

    return (
        <button type="button" onClick={onClick} disabled={disabled} className={base + " " + styles}>
            {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-b-transparent" /> : Icon ? <Icon className="h-4 w-4" /> : null}
            {label}
        </button>
    )
}

/** ✅ Single PDF hub button (OT-friendly: 1 button, 4 actions) */
function PdfHubButton({ disabled, busyKey, onPrintPreop, onDownloadPreop, onPrintFull, onDownloadFull }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 640px)")
        const update = () => setIsMobile(!!mq.matches)
        update()
        mq.addEventListener?.("change", update)
        return () => mq.removeEventListener?.("change", update)
    }, [])

    useEffect(() => {
        const onDown = (e) => {
            if (!ref.current) return
            if (!ref.current.contains(e.target)) setOpen(false)
        }
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [])

    const Item = ({ title, subtitle, onClick, itemBusy }) => (
        <button
            type="button"
            disabled={disabled || itemBusy}
            onClick={() => {
                setOpen(false)
                onClick?.()
            }}
            className="w-full px-4 py-3 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-900">{title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div>
                </div>
                {itemBusy ? <span className="mt-1 h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-b-transparent" /> : null}
            </div>
        </button>
    )

    const MenuContent = (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(2,6,23,0.14)]">
            <div className="px-4 py-3">
                <div className="text-[11px] font-semibold text-slate-900">PDF</div>
                <div className="mt-0.5 text-[11px] text-slate-500">Pre-op and Full sheets</div>
            </div>

            <div className="h-px bg-slate-200" />
            <div className="px-4 py-2 text-[11px] font-semibold text-slate-700">Pre-Anaesthetic</div>
            <Item title="Print pre-op" subtitle="Single page" onClick={onPrintPreop} itemBusy={busyKey === "print-preop"} />
            <Item title="Download pre-op" subtitle="Single page" onClick={onDownloadPreop} itemBusy={busyKey === "dl-preop"} />

            <div className="h-px bg-slate-200" />
            <div className="px-4 py-2 text-[11px] font-semibold text-slate-700">Full record</div>
            <Item title="Print full PDF" subtitle="Pre-op + Vitals + Drugs" onClick={onPrintFull} itemBusy={busyKey === "print-full"} />
            <Item title="Download full PDF" subtitle="Pre-op + Vitals + Drugs" onClick={onDownloadFull} itemBusy={busyKey === "dl-full"} />
        </div>
    )

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((s) => !s)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                title={!disabled ? "" : "Save record first to enable PDF"}
            >
                {busyKey ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-b-transparent" /> : <Download className="h-4 w-4" />}
                PDF
                <ChevronDown className="h-4 w-4 opacity-70" />
            </button>

            {open && !isMobile ? <div className="absolute right-0 z-30 mt-2 w-[320px]">{MenuContent}</div> : null}

            {open && isMobile ? (
                <div className="fixed inset-0 z-50">
                    <button type="button" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/30" aria-label="Close" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                        <div className="rounded-[28px] bg-white shadow-[0_-20px_60px_rgba(2,6,23,0.20)]">
                            <div className="flex items-center justify-between px-4 py-3">
                                <div className="text-[12px] font-semibold text-slate-900">PDF</div>
                                <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                                    Close
                                </button>
                            </div>
                            <div className="h-px bg-slate-200" />
                            <div className="max-h-[60vh] overflow-auto p-2">{MenuContent}</div>
                            <div className="p-3">
                                <div className="rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                                    Tip: If print doesn’t open on mobile, it will open the PDF in a new tab.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function NavPill({ active, onClick, icon: Icon, label, hint }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                "shrink-0 rounded-2xl px-4 py-2 text-left transition " +
                (active ? "bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50")
            }
        >
            <div className="flex items-center gap-2">
                {Icon ? <Icon className={"h-4 w-4 " + (active ? "text-white" : "text-slate-600")} /> : null}
                <div className="leading-tight">
                    <div className="text-[12px] font-semibold">{label}</div>
                    <div className={"text-[11px] " + (active ? "text-white/80" : "text-slate-500")}>{hint}</div>
                </div>
            </div>
        </button>
    )
}

function SectionCard({ title, subtitle, icon: Icon, right, children, collapsible = false, defaultOpen = true, tone = "plain" }) {
    const shell =
        tone === "soft"
            ? "rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/60 p-4 shadow-sm"
            : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"

    const header = (
        <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    {Icon ? <Icon className="h-5 w-5" /> : null}
                </span>
                <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900">{title}</div>
                    <div className="text-[12px] text-slate-500">{subtitle}</div>
                </div>
            </div>
            {right ? <div className="shrink-0">{right}</div> : null}
        </div>
    )

    if (!collapsible) {
        return (
            <div className={shell}>
                {header}
                <div className="space-y-3 text-[12px]">{children}</div>
            </div>
        )
    }

    return (
        <details className={shell} open={defaultOpen}>
            <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                            {Icon ? <Icon className="h-5 w-5" /> : null}
                        </span>
                        <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-slate-900">{title}</div>
                            <div className="text-[12px] text-slate-500">{subtitle}</div>
                        </div>
                    </div>
                    {right ? <div className="shrink-0">{right}</div> : <ChevronDown className="mt-1 h-4 w-4 text-slate-500" />}
                </div>
                <div className="mt-3 h-px bg-slate-200" />
            </summary>

            <div className="mt-3 space-y-3 text-[12px]">{children}</div>
        </details>
    )
}

function SoftInset({ title, right, children }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold text-slate-700">{title}</div>
                <div className="text-[11px] text-slate-500">{right}</div>
            </div>
            {children}
        </div>
    )
}

function SoftNotice({ children }) {
    return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700">{children}</div>
}

function Mini({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold text-slate-500">{label}</div>
            <div className="text-[12px] font-semibold text-slate-900">{value ?? "—"}</div>
        </div>
    )
}

function ProgressBar({ value, max }) {
    const pct = max ? Math.round((Math.min(value, max) / max) * 100) : 0
    return (
        <div className="rounded-full bg-slate-100 p-1">
            <div className="h-2 rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
        </div>
    )
}

function TextInput({ label, value, onChange, placeholder, disabled = false }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
            <input
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ""}
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
                className="min-h-[96px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ""}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
        </label>
    )
}

/** ✅ OT-friendly checklist tile */
function CheckTile({ label, checked, onChange, disabled }) {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            className={
                "flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-[12px] transition disabled:cursor-not-allowed disabled:opacity-60 " +
                (checked ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
            }
        >
            <span
                className={
                    "inline-flex h-5 w-5 items-center justify-center rounded-full border " +
                    (checked ? "border-emerald-300 bg-emerald-100" : "border-slate-200 bg-white")
                }
            >
                {checked ? <CheckCircle2 className="h-4 w-4" /> : null}
            </span>
            <span className="leading-tight">{label}</span>
        </button>
    )
}

/** ✅ Compact checkbox tile used for intra-op toggles */
function CheckTileCompact({ label, checked, onChange, disabled }) {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            className={
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 " +
                (checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
            }
        >
            {checked ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-slate-300" />}
            {label}
        </button>
    )
}

function Checkbox({ label, checked, onChange, disabled = false }) {
    return (
        <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
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
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            >
                {options.map((opt, idx) => (
                    <option key={`${opt || "empty"}-${idx}`} value={opt}>
                        {opt || "—"}
                    </option>
                ))}
            </select>
        </label>
    )
}

function Th({ children }) {
    return <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">{children}</th>
}
function Td({ children, className = "" }) {
    return <td className={"px-2 py-2 align-top text-[12px] text-slate-700 " + className}>{children}</td>
}
