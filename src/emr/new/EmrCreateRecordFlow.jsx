// FILE: frontend/src/emr/EmrCreateRecordFlow.jsx
import React, { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock3,
  Layers,
  Building2,
  Stethoscope,
  ClipboardList,
  FileText,
  ShieldCheck,
  Pill,
  TestTube2,
  ScanLine,
  Sparkles,
  CheckCircle2,
  PenLine,
  AlertTriangle,
  Search,
  Paperclip,
  Lock,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent } from "@/components/ui/dialog"

/**
 * ✅ EMR Create Record Flow (UI Only)
 * Steps:
 * 1) Choose Visit
 * 2) Choose Record Type
 * 3) Pick Template
 * 4) Review → Save Draft / Sign
 */

const STEPS = [
  { key: "visit", title: "Choose Visit", desc: "Pick OP/IP/ER/OT context" },
  { key: "type", title: "Record Type", desc: "What are you creating?" },
  { key: "template", title: "Template", desc: "Select best-fit case sheet" },
  { key: "review", title: "Review & Save", desc: "Draft / Sign / Attachments" },
]

// --- Departments ---
const DEPARTMENTS = [
  "Common (All)",
  "Anaesthesiology",
  "Cardiology",
  "Dermatology",
  "ENT",
  "General Medicine",
  "General Surgery",
  "ICU",
  "Neurology",
  "OBGYN",
  "Orthopedics",
  "Paediatrics",
  "Pathology/Lab",
  "Psychiatry",
  "Urology",
]

function deptTone(deptRaw) {
  const d = (deptRaw || "").toUpperCase()
  const map = {
    OBGYN: {
      bar: "from-pink-500/75 via-rose-500/55 to-orange-400/45",
      chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(244,63,94,0.55)]",
      btn: "bg-rose-600 hover:bg-rose-700",
    },
    CARDIOLOGY: {
      bar: "from-red-500/75 via-rose-500/55 to-amber-400/40",
      chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(239,68,68,0.55)]",
      btn: "bg-red-600 hover:bg-red-700",
    },
    ICU: {
      bar: "from-indigo-500/75 via-blue-500/55 to-cyan-400/40",
      chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(99,102,241,0.55)]",
      btn: "bg-indigo-600 hover:bg-indigo-700",
    },
    ORTHOPEDICS: {
      bar: "from-emerald-500/70 via-teal-500/55 to-lime-400/35",
      chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(16,185,129,0.55)]",
      btn: "bg-emerald-600 hover:bg-emerald-700",
    },
    "PATHOLOGY/LAB": {
      bar: "from-amber-500/70 via-yellow-500/55 to-orange-400/35",
      chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(245,158,11,0.55)]",
      btn: "bg-amber-600 hover:bg-amber-700",
    },
    "GENERAL MEDICINE": {
      bar: "from-slate-500/65 via-zinc-500/45 to-sky-400/30",
      chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.40)]",
      btn: "bg-slate-900 hover:bg-slate-800",
    },
  }
  return (
    map[d] || {
      bar: "from-slate-500/65 via-slate-400/35 to-sky-400/25",
      chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.30)]",
      btn: "bg-slate-900 hover:bg-slate-800",
    }
  )
}

const RECORD_TYPES = [
  { key: "OPD_NOTE", title: "OPD Consultation", icon: Stethoscope, desc: "SOAP / assessment / plan", tag: "Clinical" },
  { key: "PROGRESS_NOTE", title: "Daily Progress", icon: ClipboardList, desc: "IPD/ICU day-wise notes", tag: "IPD" },
  { key: "PRESCRIPTION", title: "Prescription", icon: Pill, desc: "Rx with dosage & duration", tag: "Pharmacy" },
  { key: "LAB_RESULT", title: "Lab Result", icon: TestTube2, desc: "Reports & observations", tag: "Diagnostics" },
  { key: "RADIOLOGY_REPORT", title: "Radiology Report", icon: ScanLine, desc: "RIS / imaging summary", tag: "Diagnostics" },
  { key: "CONSENT", title: "Consent", icon: ShieldCheck, desc: "Procedure & legal consent", tag: "Legal" },
  { key: "DISCHARGE_SUMMARY", title: "Discharge Summary", icon: FileText, desc: "Summary + advice + follow-up", tag: "IPD" },
  { key: "EXTERNAL_DOCUMENT", title: "External Document", icon: Paperclip, desc: "Upload scanned record / PDF", tag: "Docs" },
]

// UI-only template dataset
const TEMPLATES = [
  mkTpl("Common (All)", "OPD_NOTE", "OPD Consultation (Standard)", ["Chief Complaint", "History", "Exam", "Assessment", "Plan"]),
  mkTpl("Common (All)", "PROGRESS_NOTE", "Daily Progress Note (Standard)", ["Vitals", "Clinical Status", "Plan"]),
  mkTpl("Common (All)", "DISCHARGE_SUMMARY", "Discharge Summary (Standard)", ["Diagnosis", "Hospital Course", "Medications", "Advice", "Follow-up"]),
  mkTpl("Common (All)", "CONSENT", "Consent Form (Standard)", ["Procedure", "Risks", "Patient Acknowledgement"]),
  mkTpl("Common (All)", "PRESCRIPTION", "Prescription (Standard)", ["Drug", "Dose", "Duration", "Instructions"]),
  mkTpl("OBGYN", "OPD_NOTE", "OBGYN OPD Note (Premium)", ["LMP/EDD", "Obstetric History", "Exam", "Plan"]),
  mkTpl("OBGYN", "DISCHARGE_SUMMARY", "OBGYN Discharge (Mother)", ["Delivery Details", "Postpartum", "Advice"]),
  mkTpl("OBGYN", "CONSENT", "OBGYN Consent (Procedure)", ["Procedure", "Anesthesia", "Risks"]),
  mkTpl("Cardiology", "OPD_NOTE", "Cardiology OPD Note", ["Symptoms", "Risk Factors", "ECG", "Plan"]),
  mkTpl("Cardiology", "PROGRESS_NOTE", "Cardiology Progress Note", ["Vitals", "Cardiac Status", "Plan"]),
  mkTpl("Orthopedics", "OPD_NOTE", "Ortho OPD Note", ["Injury Details", "ROM", "Imaging", "Plan"]),
  mkTpl("ICU", "PROGRESS_NOTE", "ICU Progress Note (Detailed)", ["Ventilator", "ABG", "Infusions", "Plan"]),
  mkTpl("ICU", "LAB_RESULT", "ICU Lab Bundle Summary", ["CBC", "RFT/LFT", "Electrolytes"]),
  mkTpl("Pathology/Lab", "LAB_RESULT", "CBC Report Template", ["Hb", "WBC", "Platelets"]),
  mkTpl("Pathology/Lab", "LAB_RESULT", "Biochemistry Report Template", ["RFT", "LFT", "Electrolytes"]),
  mkTpl("Psychiatry", "OPD_NOTE", "Psychiatry OPD Note", ["Mood", "Sleep", "Risk", "Plan"]),
]

function mkTpl(dept, type, name, sections) {
  const id = `${dept}::${type}::${name}`.replace(/\s+/g, "_")
  return { id, dept, type, name, sections: sections || [], updated_at: "2026-01-21", premium: /Premium|Detailed/i.test(name) }
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  } catch {
    return String(d || "")
  }
}
function fmtTime(d) {
  try {
    return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

function useIsMobile(breakpointPx = 1024) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const on = () => setIsMobile(mq.matches)
    on()
    mq.addEventListener?.("change", on)
    return () => mq.removeEventListener?.("change", on)
  }, [breakpointPx])
  return isMobile
}

/** ✅ FULL SCREEN DIALOG WRAPPER (fix scroll + bottom hidden) */
export function EmrCreateRecordDialog({ open, onOpenChange, patient, defaultDept, onSaved }) {
  return (
    <Dialog open={!!open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // IMPORTANT: shadcn DialogContent default is "grid". We MUST override to flex for scrolling.
          "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0",
          "!w-[100dvw] !h-[100dvh] !max-w-none !max-h-none",
          "!flex !flex-col !gap-0 !p-0",
          "rounded-none border-0 bg-white/70 backdrop-blur-xl",
          "overflow-hidden"
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Sticky top header */}
          <div className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/75 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-slate-900">New EMR Record</div>
                <div className="text-xs text-slate-500">Choose visit → type → template → save draft / sign</div>
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => onOpenChange?.(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ✅ Scrollable body (min-h-0 is the REAL fix) */}
          <div
            className={cn(
              "flex-1 min-h-0 overflow-y-auto overscroll-contain",
              // add padding so bottom content never hides under OS/taskbar
              "pb-[calc(96px+env(safe-area-inset-bottom))]"
            )}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <EmrCreateRecordFlow
              patient={patient}
              defaultDept={defaultDept}
              onClose={() => onOpenChange?.(false)}
              onSaved={onSaved}
              fullscreen
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** ---------------- MAIN FLOW COMPONENT ---------------- */
export default function EmrCreateRecordFlow({ patient, defaultDept, onClose, onSaved, fullscreen = false }) {
  const isMobile = useIsMobile(1024)

  const [step, setStep] = useState(0)

  // selections
  const [visit, setVisit] = useState(null)
  const [recordType, setRecordType] = useState(null)
  const [dept, setDept] = useState(defaultDept || "Common (All)")
  const [template, setTemplate] = useState(null)

  // review fields
  const [title, setTitle] = useState("")
  const [confidential, setConfidential] = useState(false)
  const [note, setNote] = useState("")
  const [attachments, setAttachments] = useState([])

  // search
  const [tplQ, setTplQ] = useState("")
  const [visitQ, setVisitQ] = useState("")

  const tone = deptTone(dept)

  const visits = useMemo(() => {
    const base = patient?.uhid ? patient.uhid : "NH-000000"
    return [
      { id: "OP-2026-00122", encType: "OP", encId: "OP-2026-00122", dept: "OBGYN", doctor: "Dr. K. Priya", when: "2026-01-21T03:35:00Z", status: "In Progress" },
      { id: "OP-2026-00118", encType: "OP", encId: "OP-2026-00118", dept: "General Medicine", doctor: "Dr. R. Kumar", when: "2026-01-20T06:10:00Z", status: "Completed" },
      { id: "IP-2026-00033", encType: "IP", encId: "IP-2026-00033", dept: "ICU", doctor: "Dr. A. Selvam", when: "2026-01-14T09:00:00Z", status: "Admitted" },
      { id: "ER-2026-00009", encType: "ER", encId: "ER-2026-00009", dept: "General Surgery", doctor: "Dr. M. Vignesh", when: "2026-01-11T12:20:00Z", status: "Discharged" },
    ].map((v) => ({ ...v, patientRef: base }))
  }, [patient?.uhid])

  const filteredVisits = useMemo(() => {
    const q = (visitQ || "").trim().toLowerCase()
    if (!q) return visits
    return visits.filter((v) => `${v.encId} ${v.encType} ${v.dept} ${v.doctor} ${v.status}`.toLowerCase().includes(q))
  }, [visits, visitQ])

  const templates = useMemo(() => {
    const x = (TEMPLATES || []).filter((t) => {
      const okDept = t.dept === dept || t.dept === "Common (All)"
      const okType = recordType?.key ? t.type === recordType.key : true
      return okDept && okType
    })
    const q = (tplQ || "").trim().toLowerCase()
    if (!q) return x
    return x.filter((t) => `${t.name} ${t.dept} ${t.type} ${t.sections.join(" ")}`.toLowerCase().includes(q))
  }, [dept, recordType?.key, tplQ])

  const suggested = useMemo(() => {
    const a = templates.filter((t) => t.dept === dept)
    const b = templates.filter((t) => t.dept === "Common (All)")
    const sortFn = (x, y) => Number(!!y.premium) - Number(!!x.premium) || x.name.localeCompare(y.name)
    return { dept: [...a].sort(sortFn).slice(0, 6), common: [...b].sort(sortFn).slice(0, 6) }
  }, [templates, dept])

  useEffect(() => {
    if (visit?.dept) setDept(visit.dept)
  }, [visit?.dept])

  useEffect(() => {
    if (!template) return
    const rt = recordType?.title ? ` · ${recordType.title}` : ""
    setTitle(`${template.name}${rt}`)
  }, [template?.id]) // eslint-disable-line

  function canNext() {
    if (step === 0) return !!visit
    if (step === 1) return !!recordType
    if (step === 2) return !!template
    if (step === 3) return !!visit && !!recordType && !!template && (title || "").trim().length >= 3
    return false
  }

  function next() {
    if (!canNext()) return toast.error("Please complete this step to continue")
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function resetAll() {
    setStep(0)
    setVisit(null)
    setRecordType(null)
    setDept(defaultDept || "Common (All)")
    setTemplate(null)
    setTitle("")
    setConfidential(false)
    setNote("")
    setAttachments([])
    setTplQ("")
    setVisitQ("")
  }

  function buildPayload({ mode }) {
    return {
      patient_id: patient?.id || null,
      visit,
      record_type: recordType?.key || null,
      department: dept,
      template_id: template?.id || null,
      title: (title || "").trim(),
      confidential: !!confidential,
      note: (note || "").trim(),
      attachments: attachments || [],
      status: mode,
    }
  }

  function saveDraft() {
    if (!canNext()) return toast.error("Fill required fields before saving")
    const payload = buildPayload({ mode: "DRAFT" })
    toast.success("Draft saved (UI only)")
    onSaved?.(payload)
  }

  function saveAndSign() {
    if (!canNext()) return toast.error("Fill required fields before signing")
    const payload = buildPayload({ mode: "SIGNED" })
    toast.success("Saved & Signed (UI only)")
    onSaved?.(payload)
    resetAll()
    onClose?.()
  }

  function addFakeAttachment() {
    const n = attachments.length + 1
    setAttachments((a) => [...a, { name: `Attachment_${n}.pdf` }])
  }

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-indigo-50/60 via-white to-rose-50/60">
      <div
        className={cn(
          "mx-auto w-full max-w-[1400px]",
          "grid grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[360px_1fr]",
          fullscreen ? "pb-6" : ""
        )}
      >
        {/* Left */}
        <div className="space-y-4">
          <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
            <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Create Record</CardTitle>
              <div className="text-xs text-slate-500">Apple-premium step flow · responsive · fast</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Stepper step={step} setStep={setStep} />
              <Separator />
              <SelectionSummary patient={patient} visit={visit} recordType={recordType} dept={dept} template={template} confidential={confidential} />
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-2xl" onClick={resetAll}>
                  <X className="mr-2 h-4 w-4" /> Reset
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => toast("Hook permissions (useCan) later")}>
                  <Lock className="mr-2 h-4 w-4" /> Permissions
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="hidden lg:block">
            <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Live Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniPreview dept={dept} recordType={recordType} template={template} title={title} note={note} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right */}
        <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
          <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">{STEPS[step].title}</CardTitle>
                <div className="text-xs text-slate-500">{STEPS[step].desc}</div>
              </div>

              {/* ✅ Keep these actions here (they are visible even when scrolling) */}
              <div className="flex items-center gap-2">
                {step > 0 ? (
                  <Button variant="outline" className="rounded-2xl" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                ) : (
                  <Button variant="outline" className="rounded-2xl" onClick={() => onClose?.()}>
                    <X className="mr-2 h-4 w-4" /> Close
                  </Button>
                )}

                {step < 3 ? (
                  <Button className={cn("rounded-2xl", tone.btn)} onClick={next} disabled={!canNext()}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="rounded-2xl" onClick={saveDraft} disabled={!canNext()}>
                      <PenLine className="mr-2 h-4 w-4" /> Save Draft
                    </Button>
                    <Button className={cn("rounded-2xl", tone.btn)} onClick={saveAndSign} disabled={!canNext()}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Save & Sign
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="text-xs text-slate-600">Select the visit/encounter where this record belongs.</div>
                    <div className="relative w-full md:w-[320px]">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input value={visitQ} onChange={(e) => setVisitQ(e.target.value)} placeholder="Search visits (OP/IP/Dept/Doctor)…" className="h-10 rounded-2xl pl-9" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {filteredVisits.map((v) => (
                      <VisitCard key={v.id} visit={v} active={visit?.id === v.id} onClick={() => setVisit(v)} />
                    ))}
                  </div>

                  {!filteredVisits.length ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                      <div className="text-sm font-semibold text-slate-800">No visits found</div>
                      <div className="mt-1 text-xs text-slate-500">Try clearing search.</div>
                    </div>
                  ) : null}
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn("rounded-xl", tone.chip)}>
                      <Building2 className="mr-1 h-3.5 w-3.5" />
                      {dept}
                    </Badge>
                    {visit ? (
                      <Badge variant="outline" className="rounded-xl">
                        <Layers className="mr-1 h-3.5 w-3.5" />
                        {visit.encType} · {visit.encId}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="rounded-xl">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      Suggested types based on workflow
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {RECORD_TYPES.map((rt) => (
                      <RecordTypeCard key={rt.key} type={rt} active={recordType?.key === rt.key} tone={tone} onClick={() => setRecordType(rt)} />
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_1fr]">
                    <div className="space-y-3">
                      <div className="rounded-3xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-xs font-semibold text-slate-700">Department</div>
                        <select
                          value={dept}
                          onChange={(e) => {
                            setDept(e.target.value)
                            setTemplate(null)
                          }}
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                        >
                          {DEPARTMENTS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>

                        <div className="mt-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-3">
                          <div className="text-xs font-semibold text-slate-700">Auto Suggestions</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Templates are filtered by <span className="font-medium text-slate-700">Department</span> &{" "}
                            <span className="font-medium text-slate-700">Record Type</span>.
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input value={tplQ} onChange={(e) => setTplQ(e.target.value)} placeholder="Search templates…" className="h-10 rounded-2xl pl-9" />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className={cn("rounded-xl", tone.chip)}>
                          <Building2 className="mr-1 h-3.5 w-3.5" />
                          {dept}
                        </Badge>
                        {recordType ? (
                          <Badge variant="outline" className="rounded-xl">
                            <ClipboardList className="mr-1 h-3.5 w-3.5" />
                            {recordType.title}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <TemplateGroup title="Suggested (Department)" subtitle="Best-fit templates for this department" rows={suggested.dept} template={template} onPick={(t) => setTemplate(t)} tone={tone} />
                      <TemplateGroup title="Common (All Departments)" subtitle="Standard templates usable everywhere" rows={suggested.common} template={template} onPick={(t) => setTemplate(t)} tone={tone} />

                      {templates.length > 0 && (
                        <div className="rounded-3xl border border-slate-200 bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">All Matching Templates</div>
                              <div className="text-xs text-slate-500">{templates.length} template(s)</div>
                            </div>
                            <Badge variant="outline" className="rounded-xl">
                              Browse
                            </Badge>
                          </div>

                          <div className="max-h-[340px] overflow-auto pr-1">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {templates.map((t) => (
                                <TemplateCard key={t.id} tpl={t} active={template?.id === t.id} onClick={() => setTemplate(t)} tone={tone} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {!templates.length ? (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                          <div className="text-sm font-semibold text-slate-800">No templates found</div>
                          <div className="mt-1 text-xs text-slate-500">Try different department or remove search.</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("rounded-xl", tone.chip)}>
                            <Building2 className="mr-1 h-3.5 w-3.5" />
                            {dept}
                          </Badge>
                          {visit ? (
                            <Badge variant="outline" className="rounded-xl">
                              <Layers className="mr-1 h-3.5 w-3.5" />
                              {visit.encType} · {visit.encId}
                            </Badge>
                          ) : null}
                          {recordType ? (
                            <Badge variant="outline" className="rounded-xl">
                              <ClipboardList className="mr-1 h-3.5 w-3.5" />
                              {recordType.title}
                            </Badge>
                          ) : null}
                          {template ? (
                            <Badge variant="outline" className="rounded-xl">
                              <Sparkles className="mr-1 h-3.5 w-3.5" />
                              {template.premium ? "Premium Template" : "Standard Template"}
                            </Badge>
                          ) : null}
                        </div>

                        <Separator className="my-4" />

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <div className="mb-1 text-xs font-semibold text-slate-700">Title *</div>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Record title…" className="h-10 rounded-2xl" />
                            <div className="mt-1 text-xs text-slate-500">Min 3 characters. Auto-filled from template.</div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-3">
                            <div className="text-xs font-semibold text-slate-700">Status Policy</div>
                            <div className="mt-1 text-xs text-slate-500">Draft = editable · Signed = locked with audit trail</div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="mb-1 text-xs font-semibold text-slate-700">Internal Note (optional)</div>
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={4}
                            className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-slate-300"
                            placeholder="Add quick note for this record (visible to clinical staff)…"
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2">
                            <div className={cn("grid h-10 w-10 place-items-center rounded-2xl ring-1 ring-slate-200", confidential ? "bg-rose-50" : "bg-slate-50")}>
                              <Lock className={cn("h-5 w-5", confidential ? "text-rose-700" : "text-slate-600")} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Confidential</div>
                              <div className="text-xs text-slate-500">Mark record as restricted visibility</div>
                            </div>
                          </div>

                          <Button variant={confidential ? "default" : "outline"} className={cn("rounded-2xl", confidential ? tone.btn : "")} onClick={() => setConfidential((s) => !s)}>
                            {confidential ? "Enabled" : "Enable"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Card className={cn("rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", tone.glow)}>
                        <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Preview</CardTitle>
                          <div className="text-xs text-slate-500">Template sections & snapshot</div>
                        </CardHeader>
                        <CardContent>
                          <MiniPreview dept={dept} recordType={recordType} template={template} title={title} note={note} />
                        </CardContent>
                      </Card>

                      <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Attachments</CardTitle>
                          <div className="text-xs text-slate-500">UI only (upload integration later)</div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" className="rounded-2xl" onClick={addFakeAttachment}>
                              <Paperclip className="mr-2 h-4 w-4" />
                              Add Attachment
                            </Button>
                            <Badge variant="outline" className="rounded-xl">
                              {attachments.length} file(s)
                            </Badge>
                          </div>

                          {attachments.length ? (
                            <div className="space-y-2">
                              {attachments.map((a, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                                  <div className="min-w-0 truncate text-sm font-medium text-slate-800">{a.name}</div>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl" onClick={() => setAttachments((x) => x.filter((_, i) => i !== idx))}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
                              <div className="text-sm font-semibold text-slate-800">No attachments</div>
                              <div className="mt-1 text-xs text-slate-500">Add PDF/images later with backend upload.</div>
                            </div>
                          )}

                          {isMobile ? (
                            <div className="mt-3 rounded-3xl border border-slate-200 bg-white/85 p-3 shadow-sm backdrop-blur">
                              <div className="text-xs font-semibold text-slate-700">Mobile Actions</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button variant="outline" className="rounded-2xl" onClick={saveDraft} disabled={!canNext()}>
                                  <PenLine className="mr-2 h-4 w-4" /> Draft
                                </Button>
                                <Button className={cn("rounded-2xl", tone.btn)} onClick={saveAndSign} disabled={!canNext()}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Sign
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom helper */}
            <div className="mt-5 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                  <Sparkles className="h-5 w-5 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">UX Tip</div>
                  <div className="mt-1 text-xs text-slate-500">
                    For fastest workflow: pick <span className="font-medium text-slate-700">Visit</span> → choose{" "}
                    <span className="font-medium text-slate-700">Record Type</span> → pick{" "}
                    <span className="font-medium text-slate-700">Template</span> → save draft.
                  </div>
                </div>
              </div>
            </div>

            {step === 3 && (title || "").trim().length < 3 ? (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Title is required (min 3 characters)
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** ---------------- SMALL UI PIECES ---------------- */

function Stepper({ step, setStep }) {
  return (
    <div className="space-y-2">
      {STEPS.map((s, idx) => {
        const active = idx === step
        const done = idx < step
        return (
          <button
            key={s.key}
            onClick={() => setStep(idx)}
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition",
              active ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-white/60 hover:bg-white"
            )}
          >
            <div
              className={cn(
                "grid h-9 w-9 place-items-center rounded-2xl ring-1",
                done
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : active
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-slate-50 text-slate-700 ring-slate-200"
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm font-semibold">{idx + 1}</span>}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{s.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{s.desc}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SelectionSummary({ patient, visit, recordType, dept, template, confidential }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-700">Current Selection</div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="space-y-2 text-xs text-slate-700">
          <Row label="Patient" value={patient ? `${patient.name} (${patient.uhid})` : "—"} />
          <Row label="Visit" value={visit ? `${visit.encType} · ${visit.encId}` : "—"} />
          <Row label="Department" value={dept || "—"} />
          <Row label="Type" value={recordType ? recordType.title : "—"} />
          <Row label="Template" value={template ? template.name : "—"} />
          <Row label="Confidential" value={confidential ? "Yes" : "No"} />
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-slate-500">{label}</div>
      <div className="max-w-[70%] truncate text-right font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function VisitCard({ visit, active, onClick }) {
  const tone = deptTone(visit.dept)
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition",
        active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.bar)} />
      <div className={cn("p-4", active ? tone.glow : "")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("rounded-xl", tone.chip)}>
                <Building2 className="mr-1 h-3.5 w-3.5" />
                {visit.dept}
              </Badge>
              <Badge variant="outline" className="rounded-xl">
                <Layers className="mr-1 h-3.5 w-3.5" />
                {visit.encType} · {visit.encId}
              </Badge>
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-900">{visit.status}</div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {fmtDate(visit.when)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" /> {fmtTime(visit.when)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="h-3.5 w-3.5" /> {visit.doctor}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge className={cn("rounded-xl", active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700")}>
              {active ? "Selected" : "Select"}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  )
}

function RecordTypeCard({ type, active, tone, onClick }) {
  const Icon = type.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition",
        active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-11 w-11 place-items-center rounded-3xl ring-1 ring-slate-200",
              active ? "bg-slate-900 text-white ring-slate-900" : "bg-slate-50 text-slate-700"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{type.title}</div>
            <div className="mt-1 text-xs text-slate-500">{type.desc}</div>
            <div className="mt-2">
              <Badge variant="outline" className="rounded-xl">
                {type.tag}
              </Badge>
            </div>
          </div>
        </div>

        {active ? (
          <Badge className={cn("rounded-xl", tone.chip)}>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Selected
          </Badge>
        ) : null}
      </div>
    </button>
  )
}

function TemplateGroup({ title, subtitle, rows, template, onPick, tone }) {
  if (!rows?.length) return null
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
        <Badge className={cn("rounded-xl", tone.chip)}>
          <Sparkles className="mr-1 h-3.5 w-3.5" /> Suggested
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((t) => (
          <TemplateCard key={t.id} tpl={t} active={template?.id === t.id} onClick={() => onPick(t)} tone={tone} />
        ))}
      </div>
    </div>
  )
}

function TemplateCard({ tpl, active, onClick, tone }) {
  const isPremium = !!tpl.premium
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-3xl border bg-white p-3 text-left shadow-sm transition",
        active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{tpl.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" /> {tpl.sections?.length || 0} sections
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {fmtDate(tpl.updated_at)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isPremium ? (
            <Badge className="rounded-xl bg-slate-900 text-white">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-xl">
              Standard
            </Badge>
          )}
          {active ? (
            <Badge className={cn("rounded-xl", tone.chip)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Picked
            </Badge>
          ) : null}
        </div>
      </div>

      {(tpl.sections || []).length ? <div className="mt-3 line-clamp-2 text-xs text-slate-600">{tpl.sections.join(" · ")}</div> : null}
    </button>
  )
}

function MiniPreview({ dept, recordType, template, title, note }) {
  const tone = deptTone(dept)
  return (
    <div className={cn("rounded-3xl border border-slate-200 bg-white p-4", tone.glow)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("rounded-xl", tone.chip)}>
          <Building2 className="mr-1 h-3.5 w-3.5" />
          {dept || "—"}
        </Badge>
        {recordType ? (
          <Badge variant="outline" className="rounded-xl">
            <ClipboardList className="mr-1 h-3.5 w-3.5" />
            {recordType.title}
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-xl">
            Type —
          </Badge>
        )}
        {template?.premium ? (
          <Badge className="rounded-xl bg-slate-900 text-white">
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 text-sm font-semibold text-slate-900">{title?.trim() ? title : "Untitled Record"}</div>
      <div className="mt-1 text-xs text-slate-500">{template ? template.name : "No template selected"}</div>

      <Separator className="my-3" />

      <div className="text-xs font-semibold text-slate-700">Sections</div>
      {template?.sections?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {template.sections.slice(0, 8).map((s) => (
            <span key={s} className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {s}
            </span>
          ))}
          {template.sections.length > 8 ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              +{template.sections.length - 8} more
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-500">—</div>
      )}

      {note?.trim() ? (
        <>
          <Separator className="my-3" />
          <div className="text-xs font-semibold text-slate-700">Note</div>
          <div className="mt-1 line-clamp-3 text-xs text-slate-600">{note}</div>
        </>
      ) : null}
    </div>
  )
}
