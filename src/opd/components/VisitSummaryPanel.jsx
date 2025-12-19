// src/opd/components/VisitSummaryPanel.jsx
import { Copy, FileText, Printer, Eye } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

function cx(...xs) {
    return xs.filter(Boolean).join(" ")
}

const UI = {
    glass:
        "rounded-3xl border border-black/50 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]",
    label: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500",
    softBox: "rounded-3xl border border-black/50 bg-white/70 backdrop-blur px-4 py-3",
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

function Section({ title, value }) {
    const v = (value ?? "").toString().trim()
    if (!v) return null
    return (
        <div className="rounded-3xl border border-black/10 bg-white p-4">
            <div className="text-[12px] font-semibold text-slate-900">{title}</div>
            <div className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">
                {v}
            </div>
        </div>
    )
}

export default function VisitSummaryPanel({
    data,
    form,
    rx,
    summaryText,
    onCopy,
    onPreview,
    onPrint,
    pdfing,
}) {
    return (
        <div className="space-y-4">
            {/* Action strip */}
            <div className={cx(UI.glass, "p-4 md:p-5")}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/15 bg-black/[0.03]">
                                <FileText className="h-4 w-4 text-slate-700" />
                            </span>
                            <div className="min-w-0">
                                <div className="text-[14px] font-semibold text-slate-900 truncate">
                                    OPD Summary
                                </div>
                                <div className="text-[12px] text-slate-600">
                                    Preview exactly like print (PDF), copyable and structured.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                            onClick={onCopy}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                            onClick={onPreview}
                            disabled={pdfing}
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview PDF
                        </Button>

                        <Button
                            type="button"
                            className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                            onClick={onPrint}
                            disabled={pdfing}
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            Print PDF
                        </Button>
                    </div>
                </div>
            </div>

            {/* “Document-like” Preview */}
            <Card className={cx(UI.glass)}>
                <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                    <CardTitle className="text-base font-semibold text-slate-900">
                        Document Preview
                    </CardTitle>
                    <CardDescription className="text-[12px] text-slate-600">
                        Patient header + vitals + visit notes (clean, professional).
                    </CardDescription>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                    {/* Header block */}
                    <div className={cx(UI.softBox, "space-y-3")}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className={UI.label}>Patient</div>
                                <div className="text-[14px] font-semibold text-slate-900 truncate">
                                    {data?.patient_name || "—"}{" "}
                                    <span className="text-slate-500 font-semibold text-[12px]">
                                        (UHID {data?.uhid || "—"})
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className="rounded-full border-black/50 bg-white/85 text-[11px] font-semibold"
                                >
                                    Episode: <span className="ml-1 tabular-nums">{data?.episode_id || "—"}</span>
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="rounded-full border-black/50 bg-white/85 text-[11px] font-semibold"
                                >
                                    Visit: <span className="ml-1 tabular-nums">{data?.visit_at || "—"}</span>
                                </Badge>
                            </div>
                        </div>

                        <Separator className="bg-black/10" />

                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-700">
                            <span className="font-semibold text-slate-900">
                                {data?.department_name || "—"}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span>Dr. {data?.doctor_name || "—"}</span>
                        </div>

                        {/* vitals */}
                        {data?.current_vitals ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                                <VitalsPill label="Ht" value={data.current_vitals.height_cm ? `${data.current_vitals.height_cm} cm` : ""} />
                                <VitalsPill label="Wt" value={data.current_vitals.weight_kg ? `${data.current_vitals.weight_kg} kg` : ""} />
                                <VitalsPill label="Temp" value={data.current_vitals.temp_c ? `${data.current_vitals.temp_c} °C` : ""} />
                                <VitalsPill
                                    label="BP"
                                    value={data.current_vitals.bp_systolic ? `${data.current_vitals.bp_systolic}/${data.current_vitals.bp_diastolic} mmHg` : ""}
                                />
                                <VitalsPill label="Pulse" value={data.current_vitals.pulse ?? ""} />
                                <VitalsPill label="RR" value={data.current_vitals.rr ?? ""} />
                                <VitalsPill label="SpO₂" value={data.current_vitals.spo2 ? `${data.current_vitals.spo2}%` : ""} />
                            </div>
                        ) : null}
                    </div>

                    {/* Sections */}
                    <div className="grid gap-3 md:grid-cols-2">
                        <Section title="Chief Complaint" value={form?.chief_complaint} />
                        <Section title="Presenting Illness (HPI)" value={form?.presenting_illness} />
                        <Section title="Symptoms" value={form?.symptoms} />
                        <Section title="Review of Systems" value={form?.review_of_systems} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <Section title="Past Medical History" value={form?.medical_history} />
                        <Section title="Past Surgical History" value={form?.surgical_history} />
                        <Section title="Medication History" value={form?.medication_history} />
                        <Section title="Drug Allergy" value={form?.drug_allergy} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <Section title="General Examination" value={form?.general_examination} />
                        <Section title="Systemic Examination" value={form?.systemic_examination} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <Section title="Provisional Diagnosis" value={form?.provisional_diagnosis} />
                        <Section title="Differential Diagnosis" value={form?.differential_diagnosis} />
                        <Section title="Final Diagnosis" value={form?.final_diagnosis} />
                        <Section title="Diagnosis Codes (ICD)" value={form?.diagnosis_codes} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <Section title="Investigations" value={form?.investigations} />
                        <Section title="Treatment Plan" value={form?.treatment_plan} />
                        <Section title="Advice / Counselling" value={form?.advice} />
                        <Section title="Follow-up Plan" value={form?.followup_plan} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <Section title="Referral Notes" value={form?.referral_notes} />
                        <Section title="Procedure Notes" value={form?.procedure_notes} />
                    </div>

                    <Section title="Counselling Notes" value={form?.counselling_notes} />

                    {/* Rx preview (optional) */}
                    {Array.isArray(rx?.items) && rx.items.length ? (
                        <div className="rounded-3xl border border-black/10 bg-white p-4">
                            <div className="text-[12px] font-semibold text-slate-900">Prescription</div>
                            <div className="mt-3 overflow-auto rounded-2xl border border-black/10">
                                <table className="w-full text-[12px]">
                                    <thead className="bg-slate-50">
                                        <tr className="text-left text-slate-600">
                                            <th className="px-3 py-2 w-[52px]">S.No</th>
                                            <th className="px-3 py-2">Drug</th>
                                            <th className="px-3 py-2 w-[120px]">Strength</th>
                                            <th className="px-3 py-2 w-[150px]">Frequency</th>
                                            <th className="px-3 py-2 w-[72px]">Days</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rx.items.map((it, idx) => (
                                            <tr key={idx} className="border-t border-black/5">
                                                <td className="px-3 py-2 tabular-nums text-slate-600">{idx + 1}</td>
                                                <td className="px-3 py-2 font-semibold text-slate-900">{it.drug_name}</td>
                                                <td className="px-3 py-2 text-slate-700">{it.strength || "—"}</td>
                                                <td className="px-3 py-2 text-slate-700">{it.frequency || "—"}</td>
                                                <td className="px-3 py-2 tabular-nums text-slate-700">{it.duration_days ?? "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {rx?.notes ? (
                                <div className="mt-3 text-[12px] text-slate-700 whitespace-pre-wrap">
                                    <span className="font-semibold text-slate-900">Notes: </span>
                                    {rx.notes}
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {/* raw summary text (for copy validation) */}
                    <div className="rounded-3xl border border-black/10 bg-slate-50 p-4">
                        <div className="text-[12px] font-semibold text-slate-900">Raw Summary Text</div>
                        <pre className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">
                            {summaryText}
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
