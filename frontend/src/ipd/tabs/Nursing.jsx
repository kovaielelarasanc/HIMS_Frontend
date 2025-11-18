// src/ipd/tabs/Nursing.jsx
import { useEffect, useState } from 'react'
import { listNursingNotes, createNursingNote } from '../../api/ipd'
import { useCan } from '../../hooks/usePerm'

export default function Nursing({ admissionId, canWrite }) {
    // `canWrite` is already passed, but we also guard locally (belt & suspenders)
    const canPost = canWrite ?? useCan('ipd.nursing')

    const [items, setItems] = useState([])
    const [form, setForm] = useState({
        entry_time: '',
        patient_condition: '',
        clinical_finding: '',
        significant_events: '',
        response_progress: '',
    })
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')

    const load = async () => {
        setLoading(true); setErr('')
        try {
            const { data } = await listNursingNotes(admissionId)
            setItems(data || [])
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load')
        } finally { setLoading(false) }
    }
    useEffect(() => { load() }, [admissionId])

    const submit = async (e) => {
        e.preventDefault()
        try {
            const payload = {
                entry_time: form.entry_time ? new Date(form.entry_time).toISOString() : undefined,
                patient_condition: form.patient_condition || '',
                clinical_finding: form.clinical_finding || '',
                significant_events: form.significant_events || '',
                response_progress: form.response_progress || '',
            }
            await createNursingNote(admissionId, payload)
            setForm({ entry_time: '', patient_condition: '', clinical_finding: '', significant_events: '', response_progress: '' })
            load()
        } catch (e1) {
            setErr(e1?.response?.data?.detail || 'Save failed')
        }
    }

    return (
        <div className="space-y-4">
            {!canPost && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
                    View-only. You don’t have permission to add nursing notes.
                </div>
            )}

            {canPost && (
                <form onSubmit={submit} className="rounded-xl border bg-white p-3 space-y-2">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="text-xs text-gray-500">Entry time</label>
                            <input type="datetime-local" className="input" value={form.entry_time}
                                onChange={e => setForm(s => ({ ...s, entry_time: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Patient condition</label>
                            <input className="input" value={form.patient_condition}
                                onChange={e => setForm(s => ({ ...s, patient_condition: e.target.value }))} />
                        </div>
                        <input className="input md:col-span-2" placeholder="Clinical finding" value={form.clinical_finding}
                            onChange={e => setForm(s => ({ ...s, clinical_finding: e.target.value }))} />
                        <input className="input md:col-span-2" placeholder="Significant events" value={form.significant_events}
                            onChange={e => setForm(s => ({ ...s, significant_events: e.target.value }))} />
                        <input className="input md:col-span-2" placeholder="Response / Progress" value={form.response_progress}
                            onChange={e => setForm(s => ({ ...s, response_progress: e.target.value }))} />
                    </div>
                    <button className="btn">Add Note</button>
                </form>
            )}

            <div className="rounded-xl border bg-white">
                <div className="px-3 py-2 text-sm font-medium">Recent notes</div>
                {loading ? (
                    <div className="px-3 pb-3 text-sm">Loading…</div>
                ) : (
                    <div className="divide-y">
                        {(items || []).map(n => (
                            <div key={n.id} className="px-3 py-2 text-sm">
                                <div className="text-xs text-gray-500">{new Date(n.entry_time).toLocaleString()}</div>
                                <div className="font-medium">{n.patient_condition || '—'}</div>
                                <div className="text-gray-700">{n.clinical_finding}</div>
                                {n.significant_events && <div className="text-gray-700">Events: {n.significant_events}</div>}
                                {n.response_progress && <div className="text-gray-700">Progress: {n.response_progress}</div>}
                            </div>
                        ))}
                        {(!items || items.length === 0) && <div className="px-3 py-3 text-sm text-gray-500">No notes yet.</div>}
                    </div>
                )}
            </div>

            {err && <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 text-sm">{err}</div>}
        </div>
    )
}
