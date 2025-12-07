// FILE: frontend/src/ipd/DischargeMedsTab.jsx
import { useEffect, useState, useMemo } from 'react'
import { listDischargeMeds, saveDischargeMeds } from '../../api/ipd'
import { toast } from 'sonner'

const DOSE_UNITS = ['mg', 'g', 'ml', 'units', 'drops', 'puff', 'tab', 'cap', 'sachet']
const FREQ_TEMPLATES = ['OD', 'BD', 'TDS', 'QID', 'HS', 'SOS', 'PRN']
const DURATION_TEMPLATES = [3, 5, 7, 10, 14]

export default function DischargeMedsTab({ admissionId, canWrite = true }) {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')

    const [form, setForm] = useState({
        drugName: '',
        doseValue: '',
        doseUnit: 'mg',
        frequency: '',
        durationDays: '',
        instructions: '',
    })

    const [saving, setSaving] = useState(false)

    const hasRows = useMemo(() => Array.isArray(rows) && rows.length > 0, [rows])

    const load = async () => {
        if (!admissionId) return
        setLoading(true)
        setErr('')
        try {
            const { data } = await listDischargeMeds(admissionId)
            console.log("======================================================");
            console.log(admissionId, "dcbjdbgjdsbcjbsd");
            console.log(data, "data");
            console.log("======================================================");
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to load discharge medicines'
            setErr(msg)
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    const handleChange = (field) => (e) => {
        const value = e.target.value
        setForm((s) => ({ ...s, [field]: value }))
    }

    const handleQuickFreq = (freq) => {
        setForm((s) => ({ ...s, frequency: freq }))
    }

    const handleQuickDuration = (d) => {
        setForm((s) => ({ ...s, durationDays: String(d) }))
    }

    const resetForm = () =>
        setForm({
            drugName: '',
            doseValue: '',
            doseUnit: 'mg',
            frequency: '',
            durationDays: '',
            instructions: '',
        })

    const submit = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return

        const name = form.drugName.trim()
        if (!name) {
            toast.error('Please enter a drug name')
            return
        }

        // numeric conversion for dose + duration
        const doseNum = form.doseValue.trim() ? Number(form.doseValue) : null
        if (form.doseValue && Number.isNaN(doseNum)) {
            toast.error('Dose must be a number (e.g. 500)')
            return
        }

        const durNum = form.durationDays.trim() ? Number(form.durationDays) : null
        if (form.durationDays && (Number.isNaN(durNum) || !Number.isInteger(durNum))) {
            toast.error('Duration must be a whole number of days')
            return
        }

        const payload = {
            drug_name: name,
            dose: doseNum,
            dose_unit: form.doseUnit || '',
            route: '', // you can add route dropdown later
            frequency: form.frequency.trim(),
            duration_days: durNum,
            advice_text: form.instructions.trim(),
        }

        try {
            setSaving(true)
            await saveDischargeMeds(admissionId, payload)
            toast.success('Discharge medicine added')
            resetForm()
            await load()
        } catch (e1) {
            const msg = e1?.response?.data?.detail || 'Failed to save discharge medicine'
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const formatDose = (r) => {
        if (r.dose == null && !r.dose_unit) return '—'
        if (r.dose == null) return r.dose_unit || '—'
        return `${r.dose} ${r.dose_unit || ''}`.trim()
    }

    const formatDuration = (r) => {
        if (r.duration_days == null) return '—'
        if (r.duration_days === 0) return '0 days'
        return `${r.duration_days} days`
    }

    return (
        <div className="space-y-4 text-sm text-slate-900">
            {/* Header */}
            <div className="flex flex-col gap-2 rounded-2xl border bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-900">
                        Discharge Medications
                    </h2>
                    <p className="text-[11px] text-slate-600">
                        Define clear post-discharge prescriptions. These lines can be merged into the
                        discharge summary PDF.
                    </p>
                </div>
                {hasRows && (
                    <div className="text-[11px] text-slate-500">
                        Total medicines:{' '}
                        <span className="font-semibold text-slate-800">{rows.length}</span>
                    </div>
                )}
            </div>

            {err && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {err}
                </div>
            )}

            {/* Form */}
            {canWrite && (
                <form
                    onSubmit={submit}
                    className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm md:p-4"
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-800">
                            Add / edit discharge prescription line
                        </div>
                        {saving && (
                            <div className="text-[11px] text-slate-500">Saving…</div>
                        )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                        {/* Drug name */}
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Drug / formulation <span className="text-rose-500">*</span>
                            </label>
                            <input
                                className="input h-9 text-sm"
                                placeholder="e.g. Tab. Paracetamol"
                                value={form.drugName}
                                onChange={handleChange('drugName')}
                            />
                            <p className="mt-1 text-[10px] text-slate-400">
                                Include form (tab / cap / syrup) for clarity.
                            </p>
                        </div>

                        {/* Dose number + unit */}
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
                                    value={form.doseValue}
                                    onChange={handleChange('doseValue')}
                                />
                                <select
                                    className="input h-9 w-1/2 text-sm"
                                    value={form.doseUnit}
                                    onChange={handleChange('doseUnit')}
                                >
                                    {DOSE_UNITS.map((u) => (
                                        <option key={u} value={u}>
                                            {u}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400">
                                Number in dose box, unit separately (mg / ml / units…).
                            </p>
                        </div>

                        {/* Frequency */}
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Frequency
                            </label>
                            <input
                                className="input h-9 text-sm"
                                placeholder="e.g. BD, TDS, HS"
                                value={form.frequency}
                                onChange={handleChange('frequency')}
                            />
                            <div className="mt-1 flex flex-wrap gap-1">
                                {FREQ_TEMPLATES.map((f) => (
                                    <button
                                        type="button"
                                        key={f}
                                        onClick={() => handleQuickFreq(f)}
                                        className="rounded-full border border-slate-200 px-2 py-[1px] text-[10px] text-slate-600 hover:bg-slate-100"
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Duration */}
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Duration (days)
                            </label>
                            <input
                                className="input h-9 text-sm"
                                type="text"
                                inputMode="numeric"
                                placeholder="e.g. 5"
                                value={form.durationDays}
                                onChange={handleChange('durationDays')}
                            />
                            <div className="mt-1 flex flex-wrap gap-1">
                                {DURATION_TEMPLATES.map((d) => (
                                    <button
                                        type="button"
                                        key={d}
                                        onClick={() => handleQuickDuration(d)}
                                        className="rounded-full border border-slate-200 px-2 py-[1px] text-[10px] text-slate-600 hover:bg-slate-100"
                                    >
                                        {d}d
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            Instructions
                        </label>
                        <textarea
                            className="input min-h-[60px] text-sm"
                            placeholder="e.g. After food; stop if rash / vomiting; avoid alcohol…"
                            value={form.instructions}
                            onChange={handleChange('instructions')}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                            Clear
                        </button>
                        <button
                            type="submit"
                            className="btn"
                            disabled={saving || !canWrite}
                        >
                            {saving ? 'Saving…' : 'Add discharge med'}
                        </button>
                    </div>
                </form>
            )}

            {/* Table */}
            <div className="overflow-auto rounded-2xl border bg-white shadow-sm">
                <table className="w-full text-xs md:text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-[11px] text-slate-500 md:text-xs">
                            <th className="px-2 py-2 text-left md:px-3">Drug</th>
                            <th className="px-2 py-2 text-left md:px-3">Dose</th>
                            <th className="px-2 py-2 text-left md:px-3">Frequency</th>
                            <th className="px-2 py-2 text-left md:px-3">Duration</th>
                            <th className="px-2 py-2 text-left md:px-3">Instructions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {hasRows ? (
                            rows.map((r) => (
                                <tr key={r.id} className="border-t text-slate-800">
                                    <td className="px-2 py-2 md:px-3">{r.drug_name || '—'}</td>
                                    <td className="px-2 py-2 md:px-3">{formatDose(r)}</td>
                                    <td className="px-2 py-2 md:px-3">
                                        {r.frequency || '—'}
                                    </td>
                                    <td className="px-2 py-2 md:px-3">
                                        {formatDuration(r)}
                                    </td>
                                    <td className="whitespace-pre-wrap px-2 py-2 md:px-3">
                                        {r.advice_text || '—'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    className="px-3 py-3 text-center text-xs text-slate-500"
                                    colSpan={5}
                                >
                                    {loading
                                        ? 'Loading discharge medicines…'
                                        : 'No discharge medicines added yet.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
