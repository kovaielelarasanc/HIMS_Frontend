// FILE: frontend/src/ot/tabs/PacuTab.jsx
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
    BedDouble,
    AlertCircle,
    CheckCircle2,
    Printer,
    Download,
    Plus,
    Trash2,
} from "lucide-react"

import { useCan } from "../../hooks/useCan"
import {
    getPacuRecord,
    createPacuRecord,
    updatePacuRecord,
    getPacuRecordPdf,
} from "../../api/ot"
import { formatIST } from "@/ipd/components/timeZONE"

const ANA_METHODS = ["GA/MAC", "Spinal/Epidural", "Nerve/Plexus Block"]
const AIRWAY_SUPPORT = ["None", "Face Mask/Airway", "LMA", "Intubated", "O2"]
const MONITORING = ["SpO2", "NIBP", "ECG", "CVP"]
const POST_OP_CHARTS = ["Diabetic Chart", "I.V. Fluids", "Analgesia", "PCA Chart"]
const TUBES_DRAINS = ["Wound Drains", "Urinary Catheter", "NG Tube", "Irrigation"]

function toggleItem(list, item) {
    const arr = Array.isArray(list) ? list : []
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]
}

function toTimeInput(value) {
    if (!value) return ""
    if (/^\d{2}:\d{2}$/.test(value)) return value
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(11, 16)
    return ""
}

function PacuTab({ caseId }) {
    const canView = useCan("ot.cases.view") || useCan("ot.pacu.view") || useCan("ipd.view")
    const canCreate = useCan("ot.pacu.create") || useCan("ipd.doctor") || useCan("ipd.nursing")
    const canUpdate = useCan("ot.pacu.update") || useCan("ipd.doctor") || useCan("ipd.nursing")
    const canEdit = canCreate || canUpdate

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const [form, setForm] = useState({
        time_to_recovery: "",
        time_to_ward_icu: "",
        disposition: "",

        anaesthesia_methods: [],
        airway_support: [],
        monitoring: [],

        post_op_charts: [],
        tubes_drains: [],

        vitals_log: [
            // default one row
            { time: "", spo2: "", hr: "", bp: "", cvp: "", rbs: "", remarks: "" },
        ],

        post_op_instructions: "",
        iv_fluids_orders: "",
        notes: "",
    })

    const lastStamp = data?.updated_at || data?.created_at

    const banner = useMemo(() => {
        if (error) {
            return (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )
        }
        if (success) {
            return (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{success}</span>
                </div>
            )
        }
        return null
    }, [error, success])

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            setSuccess(null)

            const res = await getPacuRecord(caseId)
            const r = res?.data

            if (r) {
                setData(r)
                setForm({
                    time_to_recovery: toTimeInput(r.time_to_recovery) || "",
                    time_to_ward_icu: toTimeInput(r.time_to_ward_icu) || "",
                    disposition: r.disposition ?? "",

                    anaesthesia_methods: r.anaesthesia_methods ?? [],
                    airway_support: r.airway_support ?? [],
                    monitoring: r.monitoring ?? [],

                    post_op_charts: r.post_op_charts ?? [],
                    tubes_drains: r.tubes_drains ?? [],

                    vitals_log:
                        (r.vitals_log?.length ? r.vitals_log : null) ?? [
                            { time: "", spo2: "", hr: "", bp: "", cvp: "", rbs: "", remarks: "" },
                        ],

                    post_op_instructions: r.post_op_instructions ?? "",
                    iv_fluids_orders: r.iv_fluids_orders ?? "",
                    notes: r.notes ?? "",
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) setData(null)
            else setError(err?.response?.data?.detail || "Failed to load PACU record.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, canView])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (data && !canUpdate) return setError("You do not have permission to update PACU records.")
        if (!data && !canCreate) return setError("You do not have permission to create PACU records.")

        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            const payload = {
                time_to_recovery: form.time_to_recovery || null,
                time_to_ward_icu: form.time_to_ward_icu || null,
                disposition: form.disposition || null,

                anaesthesia_methods: form.anaesthesia_methods?.length ? form.anaesthesia_methods : null,
                airway_support: form.airway_support?.length ? form.airway_support : null,
                monitoring: form.monitoring?.length ? form.monitoring : null,

                post_op_charts: form.post_op_charts?.length ? form.post_op_charts : null,
                tubes_drains: form.tubes_drains?.length ? form.tubes_drains : null,

                vitals_log: form.vitals_log?.length ? form.vitals_log : null,

                post_op_instructions: form.post_op_instructions || null,
                iv_fluids_orders: form.iv_fluids_orders || null,
                notes: form.notes || null,
            }

            if (data) {
                await updatePacuRecord(caseId, payload)
                setSuccess("PACU record updated.")
            } else {
                await createPacuRecord(caseId, payload)
                setSuccess("PACU record created.")
            }

            await load()
        } catch (err) {
            const detail = err?.response?.data?.detail
            let msg = "Failed to save PACU record."
            if (Array.isArray(detail)) msg = detail.map((d) => d.msg).join(", ")
            else if (typeof detail === "string") msg = detail
            else if (err?.message) msg = err.message
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    const downloadPdf = async (mode = "download") => {
        try {
            toast.loading("Generating PACU PDF...", { id: "pacu-pdf" })
            const res = await getPacuRecordPdf(caseId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            const url = URL.createObjectURL(blob)

            if (mode === "print") {
                const w = window.open(url, "_blank")
                if (!w) throw new Error("Popup blocked. Please allow popups to print.")
                // best effort print trigger
                w.onload = () => w.print()
            } else {
                const a = document.createElement("a")
                a.href = url
                a.download = `PACU_${caseId}.pdf`
                document.body.appendChild(a)
                a.click()
                a.remove()
            }

            toast.success("PACU PDF ready.", { id: "pacu-pdf" })
            setTimeout(() => URL.revokeObjectURL(url), 1500)
        } catch (e) {
            toast.error(e?.message || "Failed to generate PACU PDF.", { id: "pacu-pdf" })
        }
    }

    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You do not have permission to view PACU records.
            </div>
        )
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border border-slate-500 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
        >
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-2"
            >
                <div className="flex items-center gap-2 text-sky-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                        <BedDouble className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold md:text-base">
                            PACU / Post-operative recovery record
                        </span>
                        <span className="text-[11px] text-slate-500">
                            Sheet fields • Vitals log • Instructions • PDF Print/Download
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {lastStamp && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Updated: {formatIST(lastStamp)}
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => downloadPdf("print")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-500 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                        <Printer className="h-4 w-4" /> Print
                    </button>

                    <button
                        type="button"
                        onClick={() => downloadPdf("download")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-500 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                        <Download className="h-4 w-4" /> Download
                    </button>
                </div>
            </motion.div>

            {banner}

            {loading ? (
                <div className="space-y-2">
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-20 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
            ) : (
                <>
                    {/* Times row */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <TimeField
                            label="Time to Recovery"
                            value={form.time_to_recovery}
                            disabled={!canEdit}
                            onChange={(v) => setForm((f) => ({ ...f, time_to_recovery: v }))}
                        />
                        <TimeField
                            label="Time to Ward / ICU"
                            value={form.time_to_ward_icu}
                            disabled={!canEdit}
                            onChange={(v) => setForm((f) => ({ ...f, time_to_ward_icu: v }))}
                        />
                        <Field
                            label="Disposition"
                            placeholder="Ward / ICU / Home"
                            value={form.disposition}
                            disabled={!canEdit}
                            onChange={(v) => setForm((f) => ({ ...f, disposition: v }))}
                        />
                    </div>

                    {/* Checkbox groups */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <CheckGroup
                            title="Anaesthesia (optional in PACU)"
                            items={ANA_METHODS}
                            value={form.anaesthesia_methods}
                            disabled={!canEdit}
                            onToggle={(it) => setForm((f) => ({ ...f, anaesthesia_methods: toggleItem(f.anaesthesia_methods, it) }))}
                        />
                        <CheckGroup
                            title="Airway Support"
                            items={AIRWAY_SUPPORT}
                            value={form.airway_support}
                            disabled={!canEdit}
                            onToggle={(it) => setForm((f) => ({ ...f, airway_support: toggleItem(f.airway_support, it) }))}
                        />
                        <CheckGroup
                            title="Monitoring"
                            items={MONITORING}
                            value={form.monitoring}
                            disabled={!canEdit}
                            onToggle={(it) => setForm((f) => ({ ...f, monitoring: toggleItem(f.monitoring, it) }))}
                        />
                        <CheckGroup
                            title="Post-op Charts"
                            items={POST_OP_CHARTS}
                            value={form.post_op_charts}
                            disabled={!canEdit}
                            onToggle={(it) => setForm((f) => ({ ...f, post_op_charts: toggleItem(f.post_op_charts, it) }))}
                        />
                    </div>

                    <CheckGroup
                        title="Wound / Tubes / Drains"
                        items={TUBES_DRAINS}
                        value={form.tubes_drains}
                        disabled={!canEdit}
                        onToggle={(it) => setForm((f) => ({ ...f, tubes_drains: toggleItem(f.tubes_drains, it) }))}
                    />

                    {/* Vitals log */}
                    <div className="rounded-2xl border border-slate-500 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Vitals / Recovery Chart Entries</div>
                                <div className="text-[11px] text-slate-500">Time • SpO₂ • HR • BP • CVP • Blood Glucose • Remarks</div>
                            </div>

                            {canEdit && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setForm((f) => ({
                                            ...f,
                                            vitals_log: [
                                                ...(f.vitals_log || []),
                                                { time: "", spo2: "", hr: "", bp: "", cvp: "", rbs: "", remarks: "" },
                                            ],
                                        }))
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-500 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                                >
                                    <Plus className="h-4 w-4" /> Add row
                                </button>
                            )}
                        </div>

                        <div className="overflow-auto rounded-xl border border-slate-200">
                            <table className="min-w-[860px] w-full text-[12px]">
                                <thead className="bg-slate-50 text-slate-700">
                                    <tr>
                                        <Th>Time</Th>
                                        <Th>SpO₂</Th>
                                        <Th>HR</Th>
                                        <Th>BP</Th>
                                        <Th>CVP</Th>
                                        <Th>Blood Glucose</Th>
                                        <Th>Remarks</Th>
                                        <Th className="w-[60px]"></Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(form.vitals_log || []).map((row, idx) => (
                                        <tr key={idx} className="border-t border-slate-200">
                                            <Td>
                                                <input
                                                    type="time"
                                                    value={row.time || ""}
                                                    disabled={!canEdit}
                                                    onChange={(e) =>
                                                        setForm((f) => {
                                                            const arr = [...(f.vitals_log || [])]
                                                            arr[idx] = { ...arr[idx], time: e.target.value }
                                                            return { ...f, vitals_log: arr }
                                                        })
                                                    }
                                                    className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 outline-none disabled:opacity-60"
                                                />
                                            </Td>
                                            {["spo2", "hr", "bp", "cvp", "rbs"].map((k) => (
                                                <Td key={k}>
                                                    <input
                                                        type="text"
                                                        value={row[k] || ""}
                                                        disabled={!canEdit}
                                                        onChange={(e) =>
                                                            setForm((f) => {
                                                                const arr = [...(f.vitals_log || [])]
                                                                arr[idx] = { ...arr[idx], [k]: e.target.value }
                                                                return { ...f, vitals_log: arr }
                                                            })
                                                        }
                                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 outline-none disabled:opacity-60"
                                                    />
                                                </Td>
                                            ))}
                                            <Td>
                                                <input
                                                    type="text"
                                                    value={row.remarks || ""}
                                                    disabled={!canEdit}
                                                    onChange={(e) =>
                                                        setForm((f) => {
                                                            const arr = [...(f.vitals_log || [])]
                                                            arr[idx] = { ...arr[idx], remarks: e.target.value }
                                                            return { ...f, vitals_log: arr }
                                                        })
                                                    }
                                                    className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 outline-none disabled:opacity-60"
                                                />
                                            </Td>
                                            <Td>
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setForm((f) => {
                                                                const arr = [...(f.vitals_log || [])]
                                                                arr.splice(idx, 1)
                                                                return { ...f, vitals_log: arr.length ? arr : [{ time: "", spo2: "", hr: "", bp: "", cvp: "", rbs: "", remarks: "" }] }
                                                            })
                                                        }
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                                        title="Remove row"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <TextArea
                            label="Post-op instructions"
                            rows={3}
                            value={form.post_op_instructions}
                            disabled={!canEdit}
                            onChange={(v) => setForm((f) => ({ ...f, post_op_instructions: v }))}
                        />
                        <TextArea
                            label="I.V. fluids orders"
                            rows={3}
                            value={form.iv_fluids_orders}
                            disabled={!canEdit}
                            onChange={(v) => setForm((f) => ({ ...f, iv_fluids_orders: v }))}
                        />
                    </div>

                    <TextArea
                        label="Notes (optional)"
                        rows={2}
                        value={form.notes}
                        disabled={!canEdit}
                        onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
                    />

                    {canEdit && (
                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-full border border-sky-600 bg-sky-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving && (
                                    <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                                )}
                                Save PACU record
                            </button>
                        </div>
                    )}
                </>
            )}
        </form>
    )
}

function Field({ label, value, onChange, placeholder, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <input
                type="text"
                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ""}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function TimeField({ label, value, onChange, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <input
                type="time"
                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ""}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function TextArea({ label, value, onChange, rows = 2, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <textarea
                rows={rows}
                className="w-full resize-none rounded-md border border-slate-500 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ""}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function CheckGroup({ title, items, value, onToggle, disabled }) {
    const selected = Array.isArray(value) ? value : []
    return (
        <div className="rounded-2xl border border-slate-500 bg-white p-3">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((it) => (
                    <label
                        key={it}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] ${selected.includes(it)
                                ? "border-sky-300 bg-sky-50 text-sky-900"
                                : "border-slate-200 bg-white text-slate-800"
                            } ${disabled ? "opacity-60" : "cursor-pointer hover:bg-slate-50"}`}
                    >
                        <input
                            type="checkbox"
                            checked={selected.includes(it)}
                            disabled={disabled}
                            onChange={() => onToggle(it)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600"
                        />
                        <span className="font-medium">{it}</span>
                    </label>
                ))}
            </div>
        </div>
    )
}

function Th({ children, className = "" }) {
    return <th className={`px-3 py-2 text-left font-semibold ${className}`}>{children}</th>
}
function Td({ children, className = "" }) {
    return <td className={`px-3 py-2 ${className}`}>{children}</td>
}

export default PacuTab
