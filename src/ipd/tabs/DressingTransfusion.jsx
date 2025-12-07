// FILE: frontend/src/ipd/tabs/DressingTransfusionTab.jsx
import { useEffect, useState } from 'react'
import {
    addDressingTransfusion,
    listDressingTransfusions,
} from '../../api/ipd'

export default function DressingTransfusionTab({ admissionId, canWrite }) {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        entry_type: 'dressing',
        done_at: '',
        site: '',
        product: '',
        volume: '',
        notes: '',
    })

    const load = async () => {
        if (!admissionId) return
        setLoading(true)
        setErr('')
        try {
            const { data } = await listDressingTransfusions(admissionId)
            setRows(data || [])
        } catch (e) {
            setErr(
                e?.response?.data?.detail ||
                'Failed to load dressing / transfusion entries'
            )
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    const toIsoSecs = (v) =>
        !v ? null : v.length === 16 ? `${v}:00` : v

    const handleChange = (field) => (e) => {
        const value = e.target.value
        setForm((s) => ({ ...s, [field]: value }))
    }

    const submit = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return

        if (!form.entry_type) {
            alert('Please select type (Dressing / Transfusion)')
            return
        }

        setSaving(true)
        try {
            const payload = {
                entry_type: form.entry_type || 'dressing',
                done_at: toIsoSecs(form.done_at) || new Date().toISOString(),
                site: form.site || '',
                product: form.entry_type === 'transfusion' ? form.product || '' : '',
                volume: form.entry_type === 'transfusion' ? form.volume || '' : '',
                notes: form.notes || '',
            }

            await addDressingTransfusion(admissionId, payload)

            // Reset form but keep last selected type for speed
            setForm((s) => ({
                entry_type: s.entry_type,
                done_at: '',
                site: '',
                product: '',
                volume: '',
                notes: '',
            }))

            await load()
        } catch (e1) {
            alert(e1?.response?.data?.detail || 'Failed to save entry')
        } finally {
            setSaving(false)
        }
    }

    const isTransfusion = form.entry_type === 'transfusion'

    return (
        <div className="space-y-4 text-sm text-black">
            <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Dressing / Transfusion</h2>
                {loading && (
                    <span className="text-[11px] text-gray-500">
                        Loading entries…
                    </span>
                )}
            </div>

            {err && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {err}
                </div>
            )}

            {canWrite && (
                <form
                    onSubmit={submit}
                    className="rounded-xl border bg-gray-50 p-3 space-y-3"
                >
                    <div className="grid gap-3 md:grid-cols-4">
                        <div>
                            <label className="text-xs text-gray-500">Type</label>
                            <select
                                className="input"
                                value={form.entry_type}
                                onChange={handleChange('entry_type')}
                            >
                                <option value="dressing">Dressing</option>
                                <option value="transfusion">Transfusion</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-gray-500">Date & time</label>
                            <input
                                type="datetime-local"
                                className="input"
                                value={form.done_at}
                                onChange={handleChange('done_at')}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs text-gray-500">Site</label>
                            <input
                                className="input"
                                placeholder={
                                    isTransfusion
                                        ? 'e.g. IV line / central line'
                                        : 'e.g. abdominal wound'
                                }
                                value={form.site}
                                onChange={handleChange('site')}
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500">
                                Product / bag
                            </label>
                            <input
                                className="input"
                                placeholder="e.g. PRBC, FFP"
                                value={form.product}
                                onChange={handleChange('product')}
                                disabled={!isTransfusion}
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500">Volume</label>
                            <input
                                className="input"
                                placeholder="e.g. 1 unit / 300 ml"
                                value={form.volume}
                                onChange={handleChange('volume')}
                                disabled={!isTransfusion}
                            />
                        </div>
                    </div>

                    <textarea
                        className="input min-h-[60px]"
                        placeholder={
                            isTransfusion
                                ? 'Notes (vitals, reaction, transfusion details…)'
                                : 'Notes (wound status, exudate, dressing type…)'
                        }
                        value={form.notes}
                        onChange={handleChange('notes')}
                    />

                    <div className="flex justify-end">
                        <button className="btn" disabled={saving}>
                            {saving ? 'Saving…' : 'Save entry'}
                        </button>
                    </div>
                </form>
            )}

            <div className="rounded-xl border bg-white overflow-auto">
                <table className="w-full text-xs md:text-sm">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 text-[11px] md:text-xs">
                            <th className="px-2 md:px-3 py-2 text-left">When</th>
                            <th className="px-2 md:px-3 py-2 text-left">Type</th>
                            <th className="px-2 md:px-3 py-2 text-left">Site</th>
                            <th className="px-2 md:px-3 py-2 text-left">Product</th>
                            <th className="px-2 md:px-3 py-2 text-left">Volume</th>
                            <th className="px-2 md:px-3 py-2 text-left">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="border-t">
                                <td className="px-2 md:px-3 py-2 align-top">
                                    {r.done_at
                                        ? new Date(r.done_at).toLocaleString()
                                        : '—'}
                                </td>
                                <td className="px-2 md:px-3 py-2 align-top capitalize">
                                    {r.entry_type || '—'}
                                </td>
                                <td className="px-2 md:px-3 py-2 align-top">
                                    {r.site || '—'}
                                </td>
                                <td className="px-2 md:px-3 py-2 align-top">
                                    {r.product || (r.entry_type === 'transfusion' ? '—' : '')}
                                </td>
                                <td className="px-2 md:px-3 py-2 align-top">
                                    {r.volume || (r.entry_type === 'transfusion' ? '—' : '')}
                                </td>
                                <td className="px-2 md:px-3 py-2 align-top whitespace-pre-wrap">
                                    {r.notes || '—'}
                                </td>
                            </tr>
                        ))}
                        {!rows.length && !loading && (
                            <tr>
                                <td
                                    className="px-3 py-3 text-gray-500 text-xs"
                                    colSpan={6}
                                >
                                    No dressing / transfusion entries yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
