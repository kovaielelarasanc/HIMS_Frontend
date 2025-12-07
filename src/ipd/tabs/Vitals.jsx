
import { useEffect, useState, useMemo } from 'react';
import { listVitals, createVital } from '../../api/ipd'
import { useCan } from '../../hooks/useCan' // fixed import

export default function Vitals({ admissionId, canWrite }) {
    const permCanWrite = useCan('ipd.nursing')
    const canPost = typeof canWrite === 'boolean' ? canWrite : permCanWrite

    const [items, setItems] = useState([])
    const [form, setForm] = useState({
        recorded_at: '',
        bp_systolic: '',
        bp_diastolic: '',
        temp_c: '',
        rr: '',
        spo2: '',
        pulse: '',
    })
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const lastVital = useMemo(
        () => (items && items.length > 0 ? items[0] : null),
        [items]
    )

    const load = async () => {
        if (!admissionId) return
        setLoading(true)
        setErr('')
        try {
            const { data } = await listVitals(admissionId)
            // assuming API returns newest first; if not, sort by recorded_at desc
            const vitals = Array.isArray(data) ? data : []
            vitals.sort((a, b) =>
                new Date(b.recorded_at || 0) - new Date(a.recorded_at || 0)
            )
            setItems(vitals)
        } catch (e) {
            console.error('Vitals load error:', e)
            setErr(e?.response?.data?.detail || 'Failed to load vitals')
            setItems([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async e => {
        e.preventDefault()
        setErr('')

        const hasAnyValue =
            form.recorded_at ||
            form.bp_systolic ||
            form.bp_diastolic ||
            form.temp_c ||
            form.rr ||
            form.spo2 ||
            form.pulse

        if (!hasAnyValue) {
            setErr('Please enter at least one vital value before saving.')
            return
        }

        try {
            setSaving(true)
            const payload = {
                recorded_at: form.recorded_at
                    ? new Date(form.recorded_at).toISOString()
                    : undefined,
                bp_systolic: form.bp_systolic
                    ? Number(form.bp_systolic)
                    : undefined,
                bp_diastolic: form.bp_diastolic
                    ? Number(form.bp_diastolic)
                    : undefined,
                temp_c: form.temp_c ? Number(form.temp_c) : undefined,
                rr: form.rr ? Number(form.rr) : undefined,
                spo2: form.spo2 ? Number(form.spo2) : undefined,
                pulse: form.pulse ? Number(form.pulse) : undefined,
            }
            await createVital(admissionId, payload)
            setForm({
                recorded_at: '',
                bp_systolic: '',
                bp_diastolic: '',
                temp_c: '',
                rr: '',
                spo2: '',
                pulse: '',
            })
            await load()
        } catch (e1) {
            console.error('Vitals save error:', e1)
            setErr(e1?.response?.data?.detail || 'Failed to save vitals')
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

    return (
        <div className="space-y-4">
            {/* Header / summary */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">
                        Vitals
                    </h2>
                    <p className="text-xs text-slate-500">
                        Track blood pressure, temperature, pulse, SpO₂ and
                        respiratory rate.
                    </p>
                </div>

                {lastVital && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <div className="font-medium text-[11px] uppercase tracking-wide text-slate-500">
                            Last recorded
                        </div>
                        <div className="mt-0.5 text-[13px]">
                            {formatDateTime(lastVital.recorded_at)}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full bg-white px-2 py-0.5 border border-slate-200">
                                BP:{' '}
                                {[lastVital.bp_systolic, lastVital.bp_diastolic]
                                    .filter(Boolean)
                                    .join('/') || '—'}
                            </span>
                            <span className="rounded-full bg-white px-2 py-0.5 border border-slate-200">
                                Temp: {lastVital.temp_c ?? '—'} °C
                            </span>
                            <span className="rounded-full bg-white px-2 py-0.5 border border-slate-200">
                                SpO₂: {lastVital.spo2 ?? '—'} %
                            </span>
                            <span className="rounded-full bg-white px-2 py-0.5 border border-slate-200">
                                Pulse: {lastVital.pulse ?? '—'} /min
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {!canPost && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    View only. You don’t have permission to record vitals.
                </div>
            )}

            {/* Form */}
            {canPost && (
                <form
                    onSubmit={handleSubmit}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium text-slate-900">
                            Record new vitals
                        </h3>
                        <span className="text-[11px] text-slate-500">
                            Fields are optional – fill what is measured.
                        </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
                        <div className="md:col-span-2 lg:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Recorded at
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
                                BP (Systolic)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="mmHg"
                                value={form.bp_systolic}
                                onChange={e =>
                                    updateField('bp_systolic', e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                BP (Diastolic)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="mmHg"
                                value={form.bp_diastolic}
                                onChange={e =>
                                    updateField('bp_diastolic', e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Temp (°C)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="°C"
                                value={form.temp_c}
                                onChange={e =>
                                    updateField('temp_c', e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                RR (/min)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="breaths/min"
                                value={form.rr}
                                onChange={e =>
                                    updateField('rr', e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                SpO₂ (%)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="%"
                                value={form.spo2}
                                onChange={e =>
                                    updateField('spo2', e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Pulse (/min)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="/min"
                                value={form.pulse}
                                onChange={e =>
                                    updateField('pulse', e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        {err && (
                            <div className="text-xs text-rose-600">
                                {err}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                            )}
                            <span>{saving ? 'Saving…' : 'Record vitals'}</span>
                        </button>
                    </div>
                </form>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <div className="text-xs font-medium text-slate-700">
                        Vitals history
                    </div>
                    <div className="text-[11px] text-slate-500">
                        {loading
                            ? 'Loading…'
                            : `${items?.length || 0} record${(items?.length || 0) === 1 ? '' : 's'
                            }`}
                    </div>
                </div>

                <div className="max-h-[320px] overflow-auto text-xs">
                    <table className="min-w-full border-collapse">
                        <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">
                                    Time
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    BP (mmHg)
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Temp (°C)
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    RR (/min)
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    SpO₂ (%)
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Pulse (/min)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading &&
                                items &&
                                items.map(v => (
                                    <tr
                                        key={v.id}
                                        className="border-t border-slate-100 hover:bg-slate-50/60"
                                    >
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {formatDateTime(v.recorded_at)}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {[
                                                v.bp_systolic,
                                                v.bp_diastolic,
                                            ]
                                                .filter(Boolean)
                                                .join('/') || '—'}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {v.temp_c ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {v.rr ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {v.spo2 ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 align-top text-slate-700">
                                            {v.pulse ?? '—'}
                                        </td>
                                    </tr>
                                ))}

                            {!loading && (!items || items.length === 0) && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-3 py-4 text-center text-slate-400"
                                    >
                                        No vitals recorded yet.
                                    </td>
                                </tr>
                            )}

                            {loading && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-3 py-4 text-center text-slate-400"
                                    >
                                        Loading vitals…
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
