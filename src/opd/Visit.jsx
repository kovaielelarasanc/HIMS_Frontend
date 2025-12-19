// FILE: src/opd/Visit.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

import {
    fetchVisit,
    updateVisit,
    createFollowup,
    fetchVisitPrescription,
    saveVisitPrescription,
    fetchVisitSummaryPdf, // ✅ server PDF
} from "../api/opd"

import QuickOrders from "@/components/QuickOrders"

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    ClipboardSignature,
    Copy,
    Eye,
    FileText,
    HeartPulse,
    Loader2,
    Microscope,
    NotebookPen,
    Pill,
    Printer,
    Save,
    ScanLine,
    ScrollText,
    Sparkles,
    Stethoscope,
    Undo2,
    User2,
} from "lucide-react"

function cx(...xs) {
    return xs.filter(Boolean).join(" ")
}

const UI = {
    page: "min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-slate-50 via-white to-slate-50",
    glass:
        "rounded-3xl border border-black/50 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]",
    chip:
        "inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700",
    chipBtn:
        "inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-black/[0.03] active:scale-[0.99] transition disabled:opacity-60",
    label: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500",
    textarea:
        "min-h-[110px] rounded-3xl border-black/50 bg-white/85 text-[13px] leading-relaxed",
    input: "h-11 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold",
    softBox: "rounded-3xl border border-black/50 bg-white/70 backdrop-blur px-4 py-3",
}

const TABS = [
    { key: "history", label: "History", icon: NotebookPen },
    { key: "exam", label: "Examination", icon: HeartPulse },
    { key: "dx", label: "Diagnosis", icon: Stethoscope },
    { key: "plan", label: "Plan", icon: ScrollText },
    { key: "orders", label: "Orders", icon: ClipboardList },
    { key: "rx", label: "Prescription", icon: Pill },
    { key: "summary", label: "Summary", icon: FileText },
]

// ✅ Templates + Macros
const TEMPLATES = {
    // HISTORY
    hpi: `Onset:\nDuration:\nCourse/Progression:\nCharacter:\nRadiation:\nAggravating factors:\nRelieving factors:\nAssociated symptoms:\nPrevious episodes:\nKey negatives:\n`,
    ros: `General:\nRespiratory:\nCardiovascular:\nGI:\nGU:\nCNS:\nMusculoskeletal:\nSkin:\nEndocrine:\nHematologic:\n`,
    pmh: `DM:\nHTN:\nAsthma/COPD:\nCAD/Stroke:\nThyroid:\nRenal:\nTB:\nOther:\n`,

    // EXAM
    exam_normal_general:
        `Conscious, oriented, afebrile.\nNo pallor / icterus / cyanosis / clubbing / lymphadenopathy / pedal edema.\nVitals stable.\n`,
    exam_normal_systemic:
        `CVS: S1S2 normal, no murmurs.\nRS: Bilateral air entry equal, no added sounds.\nPA: Soft, non-tender.\nCNS: No focal neurological deficit.\n`,
    exam_cvs: `CVS: Pulse regular, normal volume.\nS1 S2 heard, no murmurs.\nJVP normal.\n`,
    exam_rs: `RS: Chest symmetrical.\nB/L air entry equal.\nNo wheeze / crepitations.\n`,

    // DIAGNOSIS
    dx_format: `Provisional:\nDifferential:\nFinal:\n`,
    icd_hint: `Example ICD: I10 (HTN), E11.9 (T2DM), J06.9 (URTI)\n`,

    // PLAN
    plan_format: `Investigations:\n- \n\nTreatment:\n- \n\nAdvice:\n- \n\nFollow-up:\n- \n`,
    advice_general:
        `Explain red flags.\nAdequate fluids, rest.\nMedication compliance.\nReturn earlier if worsening.\n`,
}

function prettyDateTime(iso) {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    })
}

function VitalsPill({ label, value }) {
    if (value === null || value === undefined || value === "") return null
    return (
        <span className="inline-flex items-center rounded-full border border-black/50 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <span className="text-slate-500">{label}:</span>
            <span className="ml-1 tabular-nums text-slate-900">{value}</span>
        </span>
    )
}

function Field({ label, hint, children, right }) {
    return (
        <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
                <div>
                    <div className={UI.label}>{label}</div>
                    {hint ? <div className="mt-0.5 text-[12px] text-slate-600">{hint}</div> : null}
                </div>
                {right ? <div className="shrink-0">{right}</div> : null}
            </div>
            {children}
        </div>
    )
}

function normalizePayload(obj) {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) {
        if (v === undefined) continue
        if (typeof v === "string") {
            const t = v.trim()
            out[k] = t === "" ? null : t
        } else {
            out[k] = v
        }
    }
    return out
}

function buildSummary(data, form) {
    const lines = []
    const push = (title, val) => {
        const v = (val ?? "").toString().trim()
        if (!v) return
        lines.push(`${title}\n${v}\n`)
    }

    lines.push(`OPD VISIT SUMMARY`)
    lines.push(`Patient: ${data?.patient_name || "—"} (UHID ${data?.uhid || "—"})`)
    lines.push(`Episode: ${data?.episode_id || "—"}`)
    lines.push(`Doctor/Dept: ${data?.doctor_name || "—"} / ${data?.department_name || "—"}`)
    lines.push(`Visit time: ${prettyDateTime(data?.visit_at) || "—"}`)
    lines.push("")

    const v = data?.current_vitals
    if (v) {
        const parts = []
        if (v.height_cm) parts.push(`Ht ${v.height_cm} cm`)
        if (v.weight_kg) parts.push(`Wt ${v.weight_kg} kg`)
        if (v.temp_c) parts.push(`Temp ${v.temp_c} °C`)
        if (v.bp_systolic) parts.push(`BP ${v.bp_systolic}/${v.bp_diastolic} mmHg`)
        if (v.pulse) parts.push(`Pulse ${v.pulse}`)
        if (v.rr) parts.push(`RR ${v.rr}`)
        if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`)
        if (parts.length) lines.push(`Vitals: ${parts.join(" · ")}`), lines.push("")
    }

    push("Chief Complaint", form.chief_complaint)
    push("Presenting Illness (HPI)", form.presenting_illness)
    push("Symptoms", form.symptoms)
    push("Review of Systems", form.review_of_systems)

    push("Past Medical History", form.medical_history)
    push("Past Surgical History", form.surgical_history)
    push("Medication History", form.medication_history)
    push("Drug Allergy", form.drug_allergy)
    push("Family History", form.family_history)
    push("Personal/Social History", form.personal_history)
    push("Menstrual History", form.menstrual_history)
    push("Obstetric History", form.obstetric_history)
    push("Immunization History", form.immunization_history)

    push("General Examination", form.general_examination)
    push("Systemic Examination", form.systemic_examination)
    push("Local Examination", form.local_examination)

    push("Provisional Diagnosis", form.provisional_diagnosis)
    push("Differential Diagnosis", form.differential_diagnosis)
    push("Final Diagnosis", form.final_diagnosis)
    push("Diagnosis Codes (ICD)", form.diagnosis_codes)

    push("Investigations", form.investigations)
    push("Treatment Plan", form.treatment_plan)
    push("Advice/Counselling", form.advice)
    push("Follow-up Plan", form.followup_plan)
    push("Referral Notes", form.referral_notes)
    push("Procedure Notes", form.procedure_notes)
    push("Counselling Notes", form.counselling_notes)

    push("SOAP Subjective (Legacy)", form.soap_subjective)
    push("SOAP Objective (Legacy)", form.soap_objective)
    push("SOAP Assessment (Legacy)", form.soap_assessment)
    push("SOAP Plan (Legacy)", form.plan)

    return lines.join("\n")
}

function ApplyModeToggle({ mode, setMode }) {
    return (
        <div className="flex items-center gap-2">
            <span className={cx(UI.chip, "gap-1.5")}>
                <Sparkles className="h-3.5 w-3.5" />
                Smart tools
            </span>
            <button
                type="button"
                onClick={() => setMode("insert")}
                className={cx(
                    UI.chipBtn,
                    mode === "insert" ? "bg-slate-900 text-white border-slate-900" : "",
                )}
            >
                Insert
            </button>
            <button
                type="button"
                onClick={() => setMode("append")}
                className={cx(
                    UI.chipBtn,
                    mode === "append" ? "bg-slate-900 text-white border-slate-900" : "",
                )}
            >
                Append
            </button>
        </div>
    )
}

function safeNum(v) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}

export default function Visit({ currentUser }) {
    const { id } = useParams()
    const visitId = Number(id)

    const [activeTab, setActiveTab] = useState("history")

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [pdfing, setPdfing] = useState(false)

    const [data, setData] = useState(null)

    const emptyForm = useMemo(
        () => ({
            chief_complaint: "",
            symptoms: "",
            soap_subjective: "",
            soap_objective: "",
            soap_assessment: "",
            plan: "",

            presenting_illness: "",
            review_of_systems: "",

            medical_history: "",
            surgical_history: "",
            medication_history: "",
            drug_allergy: "",

            family_history: "",
            personal_history: "",

            menstrual_history: "",
            obstetric_history: "",
            immunization_history: "",

            general_examination: "",
            systemic_examination: "",
            local_examination: "",

            provisional_diagnosis: "",
            differential_diagnosis: "",
            final_diagnosis: "",
            diagnosis_codes: "",

            investigations: "",
            treatment_plan: "",
            advice: "",
            followup_plan: "",
            referral_notes: "",
            procedure_notes: "",
            counselling_notes: "",
        }),
        [],
    )

    const [form, setForm] = useState(emptyForm)
    const initialRef = useRef(JSON.stringify(emptyForm))

    const [applyMode, setApplyMode] = useState("insert") // insert | append

    // Follow-up
    const [fuDate, setFuDate] = useState("")
    const [fuNote, setFuNote] = useState("")
    const [fuSaving, setFuSaving] = useState(false)

    // Prescription
    const [rxLoading, setRxLoading] = useState(false)
    const [rxSaving, setRxSaving] = useState(false)
    const [rx, setRx] = useState({ notes: "", items: [] })

    // PDF preview
    const [pdfOpen, setPdfOpen] = useState(false)
    const [pdfUrl, setPdfUrl] = useState("")
    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
        }
    }, [pdfUrl])

    const hasChanges = useMemo(() => {
        try {
            return JSON.stringify(form) !== initialRef.current
        } catch {
            return true
        }
    }, [form])

    const onField = (name, val) => setForm((f) => ({ ...f, [name]: val }))

    const applyText = (field, text) => {
        if (!field) return
        const t = (text || "").toString()
        setForm((f) => {
            const prev = (f[field] || "").toString()
            const next =
                applyMode === "append"
                    ? prev.trim()
                        ? `${prev.trimEnd()}\n${t}`
                        : t
                    : t
            return { ...f, [field]: next }
        })
        toast.message(`${applyMode === "append" ? "Appended" : "Inserted"} to ${field.replaceAll("_", " ")}`)
    }

    const applyMulti = (patch) => {
        setForm((f) => {
            const next = { ...f }
            for (const [k, v] of Object.entries(patch || {})) {
                const prev = (next[k] || "").toString()
                const t = (v || "").toString()
                next[k] =
                    applyMode === "append"
                        ? prev.trim()
                            ? `${prev.trimEnd()}\n${t}`
                            : t
                        : t
            }
            return next
        })
        toast.message(`${applyMode === "append" ? "Appended" : "Inserted"} template`)
    }

    const setFormFromData = (d) => {
        const next = {
            ...emptyForm,

            chief_complaint: d?.chief_complaint || "",
            symptoms: d?.symptoms || "",
            soap_subjective: d?.soap_subjective || "",
            soap_objective: d?.soap_objective || "",
            soap_assessment: d?.soap_assessment || "",
            plan: d?.plan || "",

            presenting_illness: d?.presenting_illness || "",
            review_of_systems: d?.review_of_systems || "",

            medical_history: d?.medical_history || "",
            surgical_history: d?.surgical_history || "",
            medication_history: d?.medication_history || "",
            drug_allergy: d?.drug_allergy || "",

            family_history: d?.family_history || "",
            personal_history: d?.personal_history || "",

            menstrual_history: d?.menstrual_history || "",
            obstetric_history: d?.obstetric_history || "",
            immunization_history: d?.immunization_history || "",

            general_examination: d?.general_examination || "",
            systemic_examination: d?.systemic_examination || "",
            local_examination: d?.local_examination || "",

            provisional_diagnosis: d?.provisional_diagnosis || "",
            differential_diagnosis: d?.differential_diagnosis || "",
            final_diagnosis: d?.final_diagnosis || "",
            diagnosis_codes: d?.diagnosis_codes || "",

            investigations: d?.investigations || "",
            treatment_plan: d?.treatment_plan || "",
            advice: d?.advice || "",
            followup_plan: d?.followup_plan || "",
            referral_notes: d?.referral_notes || "",
            procedure_notes: d?.procedure_notes || "",
            counselling_notes: d?.counselling_notes || "",
        }
        setForm(next)
        initialRef.current = JSON.stringify(next)
    }

    const load = async () => {
        try {
            setLoading(true)
            const res = await fetchVisit(visitId)
            const d = res?.data
            setData(d)
            setFormFromData(d)
        } catch {
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    const loadRx = async () => {
        try {
            setRxLoading(true)
            const res = await fetchVisitPrescription(visitId)
            const d = res?.data || {}
            setRx({
                notes: d.notes || "",
                items: Array.isArray(d.items) ? d.items : [],
            })
        } catch {
            setRx({ notes: "", items: [] })
        } finally {
            setRxLoading(false)
        }
    }

    useEffect(() => {
        if (!visitId) return
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitId])

    useEffect(() => {
        if (!visitId) return
        if (activeTab === "rx") loadRx()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, visitId])

    const save = async () => {
        try {
            setSaving(true)
            await updateVisit(visitId, normalizePayload(form))
            toast.success("Visit updated")
            await load()
        } catch {
            toast.error("Save failed")
        } finally {
            setSaving(false)
        }
    }

    const resetChanges = () => {
        try {
            const orig = JSON.parse(initialRef.current)
            setForm(orig)
            toast.message("Reverted unsaved changes")
        } catch {
            // ignore
        }
    }

    const createFu = async () => {
        if (!fuDate) return toast.error("Select follow-up date")
        try {
            setFuSaving(true)
            await createFollowup(visitId, { due_date: fuDate, note: fuNote || undefined })
            toast.success("Follow-up created")
            setFuDate("")
            setFuNote("")
            await load()
        } catch {
            toast.error("Follow-up create failed")
        } finally {
            setFuSaving(false)
        }
    }

    // Orders wiring
    const quickOrdersPatient = useMemo(() => {
        if (!data) return null
        return {
            id: data.patient_id,
            full_name: data.patient_name,
            uhid: data.uhid,
            phone: data.phone,
            gender: data.gender,
            dob: data.dob,
            op_uid: data.op_uid,
            ip_uid: data.ip_uid,
        }
    }, [data])

    const quickOrdersOpNumber = useMemo(() => {
        if (!data) return undefined
        return data.op_uid || data.episode_id || undefined
    }, [data])

    const quickOrdersIpNumber = useMemo(() => {
        if (!data) return undefined
        return data.ip_uid || undefined
    }, [data])

    // Prescription helpers
    const addRxRow = () => {
        setRx((r) => ({
            ...r,
            items: [
                ...(r.items || []),
                { drug_name: "", strength: "", frequency: "", duration_days: 0, quantity: 0, unit_price: 0 },
            ],
        }))
    }

    const removeRxRow = (idx) =>
        setRx((r) => ({ ...r, items: (r.items || []).filter((_, i) => i !== idx) }))

    const onRxItem = (idx, key, val) =>
        setRx((r) => ({
            ...r,
            items: (r.items || []).map((it, i) => (i === idx ? { ...it, [key]: val } : it)),
        }))

    const saveRx = async () => {
        try {
            setRxSaving(true)
            const cleaned = {
                notes: (rx.notes || "").trim() || null,
                items: (rx.items || [])
                    .map((it) => ({
                        drug_name: (it.drug_name || "").trim(),
                        strength: (it.strength || "").trim() || "",
                        frequency: (it.frequency || "").trim() || "",
                        duration_days: safeNum(it.duration_days),
                        quantity: safeNum(it.quantity),
                        unit_price: safeNum(it.unit_price),
                    }))
                    .filter((it) => it.drug_name),
            }
            await saveVisitPrescription(visitId, cleaned)
            toast.success("Prescription saved")
            await loadRx()
        } catch {
            toast.error("Prescription save failed")
        } finally {
            setRxSaving(false)
        }
    }

    const summaryText = useMemo(() => buildSummary(data, form), [data, form])

    const copySummary = async () => {
        try {
            await navigator.clipboard.writeText(summaryText)
            toast.success("Summary copied")
        } catch {
            toast.error("Copy failed")
        }
    }

    const getPdfUrl = async () => {
        const res = await fetchVisitSummaryPdf(visitId)
        const blob = new Blob([res.data], { type: "application/pdf" })
        return URL.createObjectURL(blob)
    }

    const ensureSavedIfNeeded = async () => {
        if (!hasChanges) return
        toast.message("Saving before PDF…")
        await save()
    }

    // ✅ Print PDF (new tab)
    const printPdf = async () => {
        try {
            setPdfing(true)
            await ensureSavedIfNeeded()
            const url = await getPdfUrl()
            window.open(url, "_blank", "noopener,noreferrer")
            setTimeout(() => URL.revokeObjectURL(url), 60_000)
        } catch {
            toast.error("PDF print failed")
        } finally {
            setPdfing(false)
        }
    }

    // ✅ Preview PDF (modal)
    const previewPdf = async () => {
        try {
            setPdfing(true)
            await ensureSavedIfNeeded()

            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
            const url = await getPdfUrl()

            setPdfUrl(url)
            setPdfOpen(true)
        } catch {
            toast.error("PDF preview failed")
        } finally {
            setPdfing(false)
        }
    }

    if (!visitId) return <div className="p-4 text-sm">Invalid visit ID.</div>

    return (
        <div className={UI.page}>
            {/* PDF Preview Modal */}
            <Dialog
                open={pdfOpen}
                onOpenChange={(v) => {
                    setPdfOpen(v)
                    if (!v && pdfUrl) {
                        URL.revokeObjectURL(pdfUrl)
                        setPdfUrl("")
                    }
                }}
            >
                <DialogContent className="max-w-5xl w-[95vw] rounded-3xl border border-black/50 bg-white/80 backdrop-blur-xl p-0 overflow-hidden">
                    <DialogHeader className="px-5 py-4 border-b border-black/10">
                        <DialogTitle className="text-sm font-semibold text-slate-900">
                            Visit Summary PDF
                        </DialogTitle>
                    </DialogHeader>

                    <div className="h-[78vh] bg-white">
                        {pdfUrl ? (
                            <iframe
                                title="Visit Summary PDF"
                                src={pdfUrl}
                                className="h-full w-full"
                            />
                        ) : (
                            <div className="h-full w-full grid place-items-center text-sm text-slate-600">
                                Loading…
                            </div>
                        )}
                    </div>

                    <div className="px-5 py-4 border-t border-black/10 flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                            onClick={() => {
                                if (!pdfUrl) return
                                window.open(pdfUrl, "_blank", "noopener,noreferrer")
                            }}
                            disabled={!pdfUrl}
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            Open in new tab
                        </Button>
                        <Button
                            type="button"
                            className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                            onClick={() => setPdfOpen(false)}
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="mx-auto max-w-[1450px] px-4 py-6 space-y-4 md:px-8">
                {/* HERO */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cx(UI.glass, "relative overflow-hidden")}
                >
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_60%)]" />
                    <div className="relative p-5 md:p-7">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="relative inline-flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    </span>

                                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                                        OPD Visit
                                    </span>

                                    {hasChanges && !saving && !loading ? (
                                        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            Unsaved
                                        </span>
                                    ) : null}
                                </div>

                                <div className="mt-3 flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                                        <Stethoscope className="h-5 w-5 text-slate-700" />
                                    </div>

                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                                            Visit Workspace
                                        </h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Macros + templates + print-ready summary PDF.
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            {loading ? (
                                                <span className={UI.chip}>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                                                </span>
                                            ) : data ? (
                                                <>
                                                    <span className={UI.chip}>
                                                        <User2 className="h-3.5 w-3.5" />
                                                        {data.patient_name}
                                                        <span className="opacity-70">(UHID {data.uhid})</span>
                                                    </span>

                                                    <span className={UI.chip}>
                                                        <ClipboardSignature className="h-3.5 w-3.5" />
                                                        Episode{" "}
                                                        <span className="ml-1 tabular-nums">{data.episode_id}</span>
                                                    </span>

                                                    <span className={UI.chip}>
                                                        <CalendarDays className="h-3.5 w-3.5" />
                                                        {prettyDateTime(data.visit_at)}
                                                    </span>

                                                    <span className={UI.chip}>
                                                        <Stethoscope className="h-3.5 w-3.5" />
                                                        {data.department_name} · Dr. {data.doctor_name}
                                                    </span>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                <button
                                    type="button"
                                    className={cx(UI.chipBtn, "border-black/50")}
                                    onClick={resetChanges}
                                    disabled={!hasChanges || saving || loading}
                                    title="Revert unsaved changes"
                                >
                                    <Undo2 className="h-4 w-4" />
                                    Revert
                                </button>

                                <button
                                    type="button"
                                    className={cx(
                                        UI.chipBtn,
                                        "bg-slate-900 text-white border-slate-900 hover:bg-slate-800",
                                    )}
                                    onClick={save}
                                    disabled={saving || loading || !hasChanges}
                                    title="Save visit"
                                >
                                    {saving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    Save
                                </button>

                                <button
                                    type="button"
                                    className={cx(UI.chipBtn, "bg-white/85")}
                                    onClick={previewPdf}
                                    disabled={pdfing || loading}
                                    title="Preview PDF"
                                >
                                    {pdfing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                    Preview PDF
                                </button>

                                <button
                                    type="button"
                                    className={cx(UI.chipBtn, "bg-white/85")}
                                    onClick={printPdf}
                                    disabled={pdfing || loading}
                                    title="Print PDF"
                                >
                                    {pdfing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Printer className="h-4 w-4" />
                                    )}
                                    Print PDF
                                </button>
                            </div>
                        </div>

                        {/* vitals strip */}
                        {!loading && data?.current_vitals && (
                            <div className="mt-5 rounded-3xl border border-black/50 bg-white/70 backdrop-blur px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 inline-flex items-center gap-2">
                                        <HeartPulse className="h-4 w-4 text-slate-500" />
                                        Latest vitals
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-black/50 bg-white/85 text-[11px] font-semibold"
                                    >
                                        Live
                                    </Badge>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                    <VitalsPill
                                        label="Ht"
                                        value={
                                            data.current_vitals.height_cm
                                                ? `${data.current_vitals.height_cm} cm`
                                                : ""
                                        }
                                    />
                                    <VitalsPill
                                        label="Wt"
                                        value={
                                            data.current_vitals.weight_kg
                                                ? `${data.current_vitals.weight_kg} kg`
                                                : ""
                                        }
                                    />
                                    <VitalsPill
                                        label="Temp"
                                        value={
                                            data.current_vitals.temp_c
                                                ? `${data.current_vitals.temp_c} °C`
                                                : ""
                                        }
                                    />
                                    <VitalsPill
                                        label="BP"
                                        value={
                                            data.current_vitals.bp_systolic
                                                ? `${data.current_vitals.bp_systolic}/${data.current_vitals.bp_diastolic} mmHg`
                                                : ""
                                        }
                                    />
                                    <VitalsPill label="Pulse" value={data.current_vitals.pulse ?? ""} />
                                    <VitalsPill label="RR" value={data.current_vitals.rr ?? ""} />
                                    <VitalsPill
                                        label="SpO₂"
                                        value={data.current_vitals.spo2 ? `${data.current_vitals.spo2}%` : ""}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Tabs (sticky ✅ fixed) */}
                <div className="sticky top-[4.25rem] z-20">
                    <div className={cx(UI.glass, "px-3 py-2")}>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2 overflow-auto">
                                {TABS.map((t) => {
                                    const active = activeTab === t.key
                                    const Icon = t.icon
                                    return (
                                        <button
                                            key={t.key}
                                            type="button"
                                            onClick={() => setActiveTab(t.key)}
                                            className={cx(
                                                "whitespace-nowrap inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-semibold transition",
                                                active
                                                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                                    : "border-black/50 bg-white/75 text-slate-700 hover:bg-black/[0.03]",
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {t.label}
                                        </button>
                                    )
                                })}
                            </div>

                            <ApplyModeToggle mode={applyMode} setMode={setApplyMode} />
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading && (
                    <Card className={cx(UI.glass)}>
                        <CardContent className="pt-6 space-y-3">
                            <Skeleton className="h-6 w-56 rounded-2xl" />
                            <Skeleton className="h-4 w-[80%] rounded-2xl" />
                            <Skeleton className="h-40 w-full rounded-3xl" />
                        </CardContent>
                    </Card>
                )}

                {!loading && !data && (
                    <Card className={cx(UI.glass)}>
                        <CardContent className="pt-6 text-sm text-rose-700">
                            Visit not found.
                        </CardContent>
                    </Card>
                )}

                {!loading && data && (
                    <AnimatePresence mode="wait" initial={false}>
                        {/* HISTORY */}
                        {activeTab === "history" && (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">
                                            History
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Use templates for fast documentation.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="pt-4 space-y-4">
                                        <div className={cx(UI.softBox, "flex flex-wrap items-center justify-between gap-2")}>
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-slate-500" />
                                                Templates
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button className={UI.chipBtn} onClick={() => applyText("presenting_illness", TEMPLATES.hpi)}>
                                                    HPI template
                                                </button>
                                                <button className={UI.chipBtn} onClick={() => applyText("review_of_systems", TEMPLATES.ros)}>
                                                    ROS template
                                                </button>
                                                <button className={UI.chipBtn} onClick={() => applyText("medical_history", TEMPLATES.pmh)}>
                                                    PMH template
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Chief complaint">
                                                <Textarea
                                                    value={form.chief_complaint}
                                                    onChange={(e) => onField("chief_complaint", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Presenting illness (HPI)">
                                                <Textarea
                                                    value={form.presenting_illness}
                                                    onChange={(e) => onField("presenting_illness", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Symptoms">
                                                <Textarea
                                                    value={form.symptoms}
                                                    onChange={(e) => onField("symptoms", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Review of Systems (ROS)">
                                                <Textarea
                                                    value={form.review_of_systems}
                                                    onChange={(e) => onField("review_of_systems", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <Separator className="bg-black/10" />

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Past medical history (PMH)">
                                                <Textarea
                                                    value={form.medical_history}
                                                    onChange={(e) => onField("medical_history", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Past surgical history (PSH)">
                                                <Textarea
                                                    value={form.surgical_history}
                                                    onChange={(e) => onField("surgical_history", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Medication history">
                                                <Textarea
                                                    value={form.medication_history}
                                                    onChange={(e) => onField("medication_history", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Drug allergy / allergies">
                                                <Textarea
                                                    value={form.drug_allergy}
                                                    onChange={(e) => onField("drug_allergy", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Family history">
                                                <Textarea
                                                    value={form.family_history}
                                                    onChange={(e) => onField("family_history", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Personal / social history">
                                                <Textarea
                                                    value={form.personal_history}
                                                    onChange={(e) => onField("personal_history", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <Separator className="bg-black/10" />

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Menstrual history (if applicable)">
                                                <Textarea
                                                    value={form.menstrual_history}
                                                    onChange={(e) => onField("menstrual_history", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Obstetric history (if applicable)">
                                                <Textarea
                                                    value={form.obstetric_history}
                                                    onChange={(e) => onField("obstetric_history", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <Field label="Immunization history (optional)">
                                            <Textarea
                                                value={form.immunization_history}
                                                onChange={(e) => onField("immunization_history", e.target.value)}
                                                className={UI.textarea}
                                            />
                                        </Field>

                                        <div className={cx(UI.softBox, "flex items-center justify-between gap-2")}>
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <NotebookPen className="h-4 w-4 text-slate-500" />
                                                Use templates then edit — fastest and consistent.
                                            </div>
                                            <Button
                                                type="button"
                                                className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                onClick={save}
                                                disabled={saving || !hasChanges}
                                            >
                                                {saving ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                )}
                                                Save
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* EXAMINATION */}
                        {activeTab === "exam" && (
                            <motion.div
                                key="exam"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">
                                            Examination
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            One-click normal exam macros.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="pt-4 space-y-4">
                                        <div className={cx(UI.softBox, "flex flex-wrap items-center justify-between gap-2")}>
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-slate-500" />
                                                Macros
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button className={UI.chipBtn} onClick={() => applyText("general_examination", TEMPLATES.exam_normal_general)}>
                                                    Normal General
                                                </button>
                                                <button className={UI.chipBtn} onClick={() => applyText("systemic_examination", TEMPLATES.exam_normal_systemic)}>
                                                    Normal Systemic
                                                </button>
                                                <button
                                                    className={UI.chipBtn}
                                                    onClick={() =>
                                                        applyMulti({
                                                            general_examination: TEMPLATES.exam_normal_general,
                                                            systemic_examination: TEMPLATES.exam_normal_systemic,
                                                        })
                                                    }
                                                >
                                                    Normal Exam (All)
                                                </button>
                                                <button className={UI.chipBtn} onClick={() => applyText("systemic_examination", TEMPLATES.exam_cvs)}>
                                                    CVS
                                                </button>
                                                <button className={UI.chipBtn} onClick={() => applyText("systemic_examination", TEMPLATES.exam_rs)}>
                                                    RS
                                                </button>
                                            </div>
                                        </div>

                                        <Field label="General examination">
                                            <Textarea
                                                value={form.general_examination}
                                                onChange={(e) => onField("general_examination", e.target.value)}
                                                className={UI.textarea}
                                            />
                                        </Field>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Systemic examination">
                                                <Textarea
                                                    value={form.systemic_examination}
                                                    onChange={(e) => onField("systemic_examination", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Local examination (optional)">
                                                <Textarea
                                                    value={form.local_examination}
                                                    onChange={(e) => onField("local_examination", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <Separator className="bg-black/10" />

                                        <Field label="SOAP Objective (Legacy)">
                                            <Textarea
                                                value={form.soap_objective}
                                                onChange={(e) => onField("soap_objective", e.target.value)}
                                                className={UI.textarea}
                                            />
                                        </Field>

                                        <div className={cx(UI.softBox, "flex items-center justify-between gap-2")}>
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <HeartPulse className="h-4 w-4 text-slate-500" />
                                                Exam macros reduce typing and keep consistency.
                                            </div>
                                            <Button
                                                type="button"
                                                className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                onClick={save}
                                                disabled={saving || !hasChanges}
                                            >
                                                {saving ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                )}
                                                Save
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* DIAGNOSIS */}
                        {activeTab === "dx" && (
                            <motion.div
                                key="dx"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">
                                            Diagnosis
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Templates for Dx formatting + ICD hints.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="pt-4 space-y-4">
                                        <div className={cx(UI.softBox, "flex flex-wrap items-center justify-between gap-2")}>
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-slate-500" />
                                                Templates
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    className={UI.chipBtn}
                                                    onClick={() =>
                                                        applyMulti({
                                                            provisional_diagnosis: TEMPLATES.dx_format,
                                                        })
                                                    }
                                                >
                                                    Dx format
                                                </button>
                                                <button className={UI.chipBtn} onClick={() => applyText("diagnosis_codes", TEMPLATES.icd_hint)}>
                                                    ICD hint
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Provisional diagnosis">
                                                <Textarea
                                                    value={form.provisional_diagnosis}
                                                    onChange={(e) => onField("provisional_diagnosis", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Differential diagnosis">
                                                <Textarea
                                                    value={form.differential_diagnosis}
                                                    onChange={(e) => onField("differential_diagnosis", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <Field label="Final diagnosis">
                                            <Textarea
                                                value={form.final_diagnosis}
                                                onChange={(e) => onField("final_diagnosis", e.target.value)}
                                                className={UI.textarea}
                                            />
                                        </Field>

                                        <Field label="Diagnosis codes (ICD)" hint="Comma-separated (example: I10,E11.9)">
                                            <Input
                                                value={form.diagnosis_codes}
                                                onChange={(e) => onField("diagnosis_codes", e.target.value)}
                                                placeholder="I10,E11.9"
                                                className={UI.input}
                                            />
                                        </Field>

                                        <Field label="SOAP Assessment (Legacy)">
                                            <Textarea
                                                value={form.soap_assessment}
                                                onChange={(e) => onField("soap_assessment", e.target.value)}
                                                className={UI.textarea}
                                            />
                                        </Field>

                                        <div className={cx(UI.softBox, "flex items-center justify-between gap-2")}>
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <Stethoscope className="h-4 w-4 text-slate-500" />
                                                Dx should match plan + orders + Rx.
                                            </div>
                                            <Button
                                                type="button"
                                                className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                onClick={save}
                                                disabled={saving || !hasChanges}
                                            >
                                                {saving ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                )}
                                                Save
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* PLAN */}
                        {activeTab === "plan" && (
                            <motion.div
                                key="plan"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">
                                            Plan
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Plan templates + follow-up creation.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="pt-4 space-y-4">
                                        <div className={cx(UI.softBox, "flex flex-wrap items-center justify-between gap-2")}>
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-slate-500" />
                                                Templates
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    className={UI.chipBtn}
                                                    onClick={() =>
                                                        applyMulti({
                                                            investigations: TEMPLATES.plan_format,
                                                        })
                                                    }
                                                >
                                                    Plan format
                                                </button>
                                                <button className={UI.chipBtn} onClick={() => applyText("advice", TEMPLATES.advice_general)}>
                                                    General advice
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Investigations">
                                                <Textarea
                                                    value={form.investigations}
                                                    onChange={(e) => onField("investigations", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Treatment plan">
                                                <Textarea
                                                    value={form.treatment_plan}
                                                    onChange={(e) => onField("treatment_plan", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Advice / counselling">
                                                <Textarea
                                                    value={form.advice}
                                                    onChange={(e) => onField("advice", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Follow-up plan (clinical)">
                                                <Textarea
                                                    value={form.followup_plan}
                                                    onChange={(e) => onField("followup_plan", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <Separator className="bg-black/10" />

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <Field label="Referral notes (optional)">
                                                <Textarea
                                                    value={form.referral_notes}
                                                    onChange={(e) => onField("referral_notes", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>

                                            <Field label="Procedure notes (optional)">
                                                <Textarea
                                                    value={form.procedure_notes}
                                                    onChange={(e) => onField("procedure_notes", e.target.value)}
                                                    className={UI.textarea}
                                                />
                                            </Field>
                                        </div>

                                        <Field label="Counselling notes (optional)">
                                            <Textarea
                                                value={form.counselling_notes}
                                                onChange={(e) => onField("counselling_notes", e.target.value)}
                                                className={UI.textarea}
                                            />
                                        </Field>

                                        <Separator className="bg-black/10" />

                                        {/* Follow-up create */}
                                        <div className={cx(UI.softBox, "space-y-3")}>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-[12px] font-semibold text-slate-900 inline-flex items-center gap-2">
                                                    <CalendarDays className="h-4 w-4 text-slate-500" />
                                                    Create Follow-up
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full border-black/50 bg-white/85 text-[11px] font-semibold"
                                                >
                                                    Reminder
                                                </Badge>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-[1fr,2fr,auto] md:items-end">
                                                <div className="space-y-2">
                                                    <div className={UI.label}>Follow-up date</div>
                                                    <Input
                                                        type="date"
                                                        value={fuDate}
                                                        onChange={(e) => setFuDate(e.target.value)}
                                                        className={UI.input}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <div className={UI.label}>Note</div>
                                                    <Input
                                                        value={fuNote}
                                                        onChange={(e) => setFuNote(e.target.value)}
                                                        placeholder="Review in 2 weeks / discuss reports…"
                                                        className={UI.input}
                                                    />
                                                </div>

                                                <Button
                                                    type="button"
                                                    className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6"
                                                    onClick={createFu}
                                                    disabled={fuSaving}
                                                >
                                                    {fuSaving ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <CalendarDays className="mr-2 h-4 w-4" />
                                                    )}
                                                    Create
                                                </Button>
                                            </div>
                                        </div>

                                        <div className={cx(UI.softBox, "flex items-center justify-between gap-2")}>
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <ScrollText className="h-4 w-4 text-slate-500" />
                                                Plan should match Dx + orders + Rx.
                                            </div>
                                            <Button
                                                type="button"
                                                className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                onClick={save}
                                                disabled={saving || !hasChanges}
                                            >
                                                {saving ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                )}
                                                Save
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* ORDERS */}
                        {activeTab === "orders" && (
                            <motion.div
                                key="orders"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">
                                            Orders
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Lab / Radiology / Pharmacy orders.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="pt-4 space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            <span className={UI.chip}>
                                                <Microscope className="h-3.5 w-3.5" /> Lab
                                            </span>
                                            <span className={UI.chip}>
                                                <ScanLine className="h-3.5 w-3.5" /> Radiology
                                            </span>
                                            <span className={UI.chip}>
                                                <Pill className="h-3.5 w-3.5" /> Pharmacy
                                            </span>
                                        </div>

                                        <QuickOrders
                                            patient={quickOrdersPatient}
                                            contextType="opd"
                                            contextId={visitId}
                                            opNumber={quickOrdersOpNumber}
                                            ipNumber={quickOrdersIpNumber}
                                            currentUser={currentUser}
                                            defaultLocationId={undefined}
                                        />
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* PRESCRIPTION */}
                        {activeTab === "rx" && (
                            <motion.div
                                key="rx"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">
                                            Prescription
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Add medicines and save.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="pt-4 space-y-4">
                                        {rxLoading ? (
                                            <div className="space-y-3">
                                                <Skeleton className="h-10 w-64 rounded-2xl" />
                                                <Skeleton className="h-28 w-full rounded-3xl" />
                                            </div>
                                        ) : (
                                            <>
                                                <Field label="Prescription notes (optional)">
                                                    <Textarea
                                                        value={rx.notes}
                                                        onChange={(e) => setRx((r) => ({ ...r, notes: e.target.value }))}
                                                        className={UI.textarea}
                                                    />
                                                </Field>

                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-[12px] font-semibold text-slate-900 inline-flex items-center gap-2">
                                                        <Pill className="h-4 w-4 text-slate-500" />
                                                        Medicines
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                        onClick={addRxRow}
                                                    >
                                                        + Add medicine
                                                    </Button>
                                                </div>

                                                {(rx.items || []).length === 0 ? (
                                                    <div className={cx(UI.softBox, "text-[12px] text-slate-600")}>
                                                        No medicines added yet.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {(rx.items || []).map((it, idx) => (
                                                            <div key={idx} className="rounded-3xl border border-black/50 bg-white/70 p-3">
                                                                <div className="grid gap-3 md:grid-cols-12 md:items-end">
                                                                    <div className="md:col-span-4">
                                                                        <div className={UI.label}>Drug name</div>
                                                                        <Input
                                                                            value={it.drug_name || ""}
                                                                            onChange={(e) => onRxItem(idx, "drug_name", e.target.value)}
                                                                            placeholder="e.g., Tab Paracetamol"
                                                                            className={UI.input}
                                                                        />
                                                                    </div>

                                                                    <div className="md:col-span-2">
                                                                        <div className={UI.label}>Strength</div>
                                                                        <Input
                                                                            value={it.strength || ""}
                                                                            onChange={(e) => onRxItem(idx, "strength", e.target.value)}
                                                                            placeholder="500 mg"
                                                                            className={UI.input}
                                                                        />
                                                                    </div>

                                                                    <div className="md:col-span-3">
                                                                        <div className={UI.label}>Frequency</div>
                                                                        <Input
                                                                            value={it.frequency || ""}
                                                                            onChange={(e) => onRxItem(idx, "frequency", e.target.value)}
                                                                            placeholder="1-0-1 / BD / TID"
                                                                            className={UI.input}
                                                                        />
                                                                    </div>

                                                                    <div className="md:col-span-1">
                                                                        <div className={UI.label}>Days</div>
                                                                        <Input
                                                                            type="number"
                                                                            value={it.duration_days ?? 0}
                                                                            onChange={(e) => onRxItem(idx, "duration_days", e.target.value)}
                                                                            className={UI.input}
                                                                        />
                                                                    </div>

                                                                    <div className="md:col-span-1">
                                                                        <div className={UI.label}>Qty</div>
                                                                        <Input
                                                                            type="number"
                                                                            value={it.quantity ?? 0}
                                                                            onChange={(e) => onRxItem(idx, "quantity", e.target.value)}
                                                                            className={UI.input}
                                                                        />
                                                                    </div>

                                                                    <div className="md:col-span-1 flex md:justify-end">
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            className="h-11 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                                            onClick={() => removeRxRow(idx)}
                                                                        >
                                                                            Remove
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className={cx(UI.softBox, "flex items-center justify-between gap-2")}>
                                                    <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                        <ClipboardSignature className="h-4 w-4 text-slate-500" />
                                                        Save prescription after adding medicines.
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                        onClick={saveRx}
                                                        disabled={rxSaving}
                                                    >
                                                        {rxSaving ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                                        )}
                                                        Save prescription
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* SUMMARY */}
                        {activeTab === "summary" && (
                            <motion.div
                                key="summary"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-4"
                            >
                                <Card className={cx(UI.glass)}>
                                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                        <CardTitle className="text-base font-semibold text-slate-900">
                                            Summary
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Copy or print PDF.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="pt-4 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="text-[12px] text-slate-600 inline-flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-slate-500" />
                                                Summary built from your entries.
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                    onClick={copySummary}
                                                >
                                                    <Copy className="mr-2 h-4 w-4" />
                                                    Copy
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                    onClick={previewPdf}
                                                    disabled={pdfing}
                                                >
                                                    {pdfing ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Eye className="mr-2 h-4 w-4" />
                                                    )}
                                                    Preview PDF
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                    onClick={printPdf}
                                                    disabled={pdfing}
                                                >
                                                    {pdfing ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Printer className="mr-2 h-4 w-4" />
                                                    )}
                                                    Print PDF
                                                </Button>
                                            </div>
                                        </div>

                                        <pre className="whitespace-pre-wrap rounded-3xl border border-black/50 bg-white/80 p-4 text-[12.5px] leading-relaxed text-slate-800">
                                            {summaryText}
                                        </pre>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    )
}
