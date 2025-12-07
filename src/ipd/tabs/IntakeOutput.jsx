// FILE: src/ipd/tabs/IntakeOutput.jsx
import { useEffect, useMemo, useState } from 'react'
import { listIO, addIO } from '../../api/ipd'
import PermGate from '../../components/PermGate'

export default function IntakeOutput({ admissionId }) {
    const [rows, setRows] = useState([])
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        recorded_at: '',
        intake_ml: '',
        urine_ml: '',
        drains_ml: '',
        stools_count: '',
        remarks: '',
    })

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const toISO = v => {
        if (!v) return undefined
        // datetime-local returns "YYYY-MM-DDTHH:MM"
        if (v.length === 16) return `${v}:00`
        return v
    }

    const load = async () => {
        if (!admissionId) return
        setErr('')
        setLoading(true)
        try {
            const { data } = await listIO(admissionId)
            const sorted = (data || []).slice().sort(
                (a, b) =>
                    new Date(b.recorded_at || 0) -
                    new Date(a.recorded_at || 0)
            )
            setRows(sorted)
        } catch (e) {
            console.error('I/O load error:', e)
            setErr(e?.response?.data?.detail || 'Failed to load intake / output')
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    const handleSubmit = async e => {
        e.preventDefault()
        setErr('')

        const hasAnyValue =
            form.intake_ml ||
            form.urine_ml ||
            form.drains_ml ||
            form.stools_count

        if (!hasAnyValue) {
            setErr('Enter at least one value (Intake / Urine / Drains / Stools).')
            return
        }

        try {
            setSaving(true)
            const payload = {
                recorded_at: toISO(form.recorded_at),
                intake_ml: form.intake_ml ? Number(form.intake_ml) : 0,
                urine_ml: form.urine_ml ? Number(form.urine_ml) : 0,
                drains_ml: form.drains_ml ? Number(form.drains_ml) : 0,
                stools_count: form.stools_count ? Number(form.stools_count) : 0,
                remarks: form.remarks || '',
            }
            await addIO(admissionId, payload)
            setForm({
                recorded_at: '',
                intake_ml: '',
                urine_ml: '',
                drains_ml: '',
                stools_count: '',
                remarks: '',
            })
            await load()
        } catch (e1) {
            console.error('I/O save error:', e1)
            setErr(e1?.response?.data?.detail || 'Failed to add intake / output')
        } finally {
            setSaving(false)
        }
    }

    const formatDateTime = dt => {
        if (!dt) return '—'
        try {
            const d = new Date(dt)
            if (Number.isNaN(d.getTime())) return '—'
            return d.toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle: 'short',
            })
        } catch {
            return '—'
        }
    }

    const getShift = dateStr => {
        if (!dateStr) return 'Night'
        const d = new Date(dateStr)
        if (Number.isNaN(d.getTime())) return 'Night'
        const h = d.getHours()
        if (h >= 6 && h < 14) return 'Morning'
        if (h >= 14 && h < 22) return 'Evening'
        return 'Night'
    }

    // --- 24-hr & shift summary (doctor-friendly) ---
    const todaySummary = useMemo(() => {
        if (!rows || rows.length === 0) return null

        const now = new Date()
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 1)

        const shifts = {
            Morning: { intake: 0, output: 0 },
            Evening: { intake: 0, output: 0 },
            Night: { intake: 0, output: 0 },
        }

        let totalIntake = 0
        let totalOutput = 0

        rows.forEach(r => {
            const dt = new Date(r.recorded_at)
            if (Number.isNaN(dt.getTime())) return
            if (dt < start || dt >= end) return // only today

            const intake = Number(r.intake_ml || 0)
            const output =
                Number(r.urine_ml || 0) + Number(r.drains_ml || 0)

            totalIntake += intake
            totalOutput += output

            const shift = getShift(r.recorded_at)
            shifts[shift].intake += intake
            shifts[shift].output += output
        })

        return {
            date: start,
            intake: totalIntake,
            output: totalOutput,
            net: totalIntake - totalOutput,
            shifts,
        }
    }, [rows])

    const formatMl = v =>
        !v || Number(v) === 0 ? '—' : `${Number(v)} ml`

    const formatNet = v => {
        if (v === 0) return '0 ml'
        const sign = v > 0 ? '+' : ''
        return `${sign}${v} ml`
    }

    return (
        <div className="space-y-4">
            {/* Header + Today Summary */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">
                        Intake / Output Chart
                    </h2>
                    <p className="text-xs text-slate-500">
                        Track fluids over 24 hours. Automatically shows total
                        intake, total output, and net balance for today.
                    </p>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
                    <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-[11px] uppercase tracking-wide text-slate-500">
                            Today&apos;s 24-hr balance
                        </span>
                        <span className="text-[11px] text-slate-500">
                            {todaySummary
                                ? todaySummary.date.toLocaleDateString()
                                : 'No data'}
                        </span>
                    </div>

                    <div className="mt-1 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-white px-2 py-1.5 text-center shadow-sm">
                            <div className="text-[10px] font-medium text-slate-500">
                                Total Intake
                            </div>
                            <div className="text-xs font-semibold text-sky-700">
                                {todaySummary
                                    ? `${todaySummary.intake} ml`
                                    : '0 ml'}
                            </div>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-1.5 text-center shadow-sm">
                            <div className="text-[10px] font-medium text-slate-500">
                                Total Output
                            </div>
                            <div className="text-xs font-semibold text-emerald-700">
                                {todaySummary
                                    ? `${todaySummary.output} ml`
                                    : '0 ml'}
                            </div>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-1.5 text-center shadow-sm">
                            <div className="text-[10px] font-medium text-slate-500">
                                Net Balance
                            </div>
                            <div
                                className={`text-xs font-semibold ${todaySummary
                                    ? todaySummary.net >= 0
                                        ? 'text-sky-800'
                                        : 'text-rose-700'
                                    : 'text-slate-400'
                                    }`}
                            >
                                {todaySummary ? formatNet(todaySummary.net) : '0 ml'}
                            </div>
                        </div>
                    </div>

                    {todaySummary && (
                        <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-slate-600">
                            {['Morning', 'Evening', 'Night'].map(shift => (
                                <div
                                    key={shift}
                                    className="rounded-lg border border-slate-200 bg-white px-1.5 py-1"
                                >
                                    <div className="font-medium text-[10px]">
                                        {shift}
                                    </div>
                                    <div className="mt-0.5 flex flex-col gap-0.5">
                                        <span>
                                            In:{' '}
                                            {todaySummary.shifts[shift].intake ||
                                                todaySummary.shifts[shift].output
                                                ? `${todaySummary.shifts[shift].intake} ml`
                                                : '—'}
                                        </span>
                                        <span>
                                            Out:{' '}
                                            {todaySummary.shifts[shift].output ||
                                                todaySummary.shifts[shift].intake
                                                ? `${todaySummary.shifts[shift].output} ml`
                                                : '—'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Form (only for ipd.nursing) */}
            <PermGate anyOf={['ipd.nursing']}>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium text-slate-900">
                            Record Intake / Output
                        </h3>
                        <span className="text-[11px] text-slate-500">
                            Enter what is measured; others can be left blank.
                        </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-6">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Date &amp; Time
                            </label>
                            <input
                                type="datetime-local"
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                value={form.recorded_at}
                                onChange={e =>
                                    updateField('recorded_at', e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Intake (ml)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="Oral / IV / Blood"
                                value={form.intake_ml}
                                onChange={e =>
                                    updateField('intake_ml', e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Urine (ml)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="Foley / voided"
                                value={form.urine_ml}
                                onChange={e =>
                                    updateField('urine_ml', e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Drains (ml)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="Abdominal / chest"
                                value={form.drains_ml}
                                onChange={e =>
                                    updateField('drains_ml', e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Stools (count)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="Number of times"
                                value={form.stools_count}
                                onChange={e =>
                                    updateField('stools_count', e.target.value)
                                }
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Remarks / Description
                            </label>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="RL, NS, Water, Urine via Foley, Abdominal drain..."
                                value={form.remarks}
                                onChange={e =>
                                    updateField('remarks', e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        {err && (
                            <div className="text-xs text-rose-600">{err}</div>
                        )}
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                            )}
                            <span>{saving ? 'Saving…' : 'Save entry'}</span>
                        </button>
                    </div>
                </form>
            </PermGate>

            {/* History table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs">
                    <div className="font-medium text-slate-700">
                        I/O history
                    </div>
                    <div className="text-[11px] text-slate-500">
                        {loading
                            ? 'Loading…'
                            : `${rows?.length || 0} record${(rows?.length || 0) === 1 ? '' : 's'
                            }`}
                    </div>
                </div>

                <div className="max-h-[320px] overflow-auto text-xs">
                    <table className="min-w-[680px] w-full border-collapse">
                        <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">
                                    Time
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Intake (ml)
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Urine (ml)
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Drains (ml)
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Stools (count)
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Shift
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Remarks
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading &&
                                rows &&
                                rows.map(r => (
                                    <tr
                                        key={r.id}
                                        className="border-t border-slate-100 hover:bg-slate-50/60"
                                    >
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {formatDateTime(r.recorded_at)}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {formatMl(r.intake_ml)}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {formatMl(r.urine_ml)}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {formatMl(r.drains_ml)}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {r.stools_count || '—'}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {getShift(r.recorded_at)}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {r.remarks || '—'}
                                        </td>
                                    </tr>
                                ))}

                            {!loading && (!rows || rows.length === 0) && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-3 py-4 text-center text-slate-400"
                                    >
                                        No intake / output entries yet.
                                    </td>
                                </tr>
                            )}

                            {loading && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-3 py-4 text-center text-slate-400"
                                    >
                                        Loading intake / output…
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
