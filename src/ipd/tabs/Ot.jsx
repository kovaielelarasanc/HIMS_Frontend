import { useEffect, useState } from 'react'
import { listOtCases, addOtCase, getAnaesthesia, saveAnaesthesia } from '../../api/ipd'

export default function OtModule({ admissionId }) {
    const [rows, setRows] = useState([])
    const [err, setErr] = useState('')
    const [f, setF] = useState({ surgery_name: '', scheduled_start: '', scheduled_end: '', status: 'planned', surgeon_id: '', anaesthetist_id: '', staff_tags: '', preop_notes: '' })
    const [ana, setAna] = useState({ ot_case_id: '', pre_assessment: '', anaesthesia_type: 'general', intraop_monitoring: '', drugs_administered: '', post_status: '' })

    const load = async () => {
        setErr('')
        try { const { data } = await listOtCases(admissionId); setRows(data || []) }
        catch (e) { setErr(e?.response?.data?.detail || 'Failed to load OT cases') }
    }
    useEffect(() => { load() }, [admissionId])

    const submit = async (e) => {
        e.preventDefault()
        try {
            const payload = {
                admission_id: admissionId,
                surgery_name: f.surgery_name,
                scheduled_start: f.scheduled_start ? (f.scheduled_start.length === 16 ? `${f.scheduled_start}:00` : f.scheduled_start) : undefined,
                scheduled_end: f.scheduled_end ? (f.scheduled_end.length === 16 ? `${f.scheduled_end}:00` : f.scheduled_end) : undefined,
                status: f.status || 'planned',
                surgeon_id: f.surgeon_id ? Number(f.surgeon_id) : undefined,
                anaesthetist_id: f.anaesthetist_id ? Number(f.anaesthetist_id) : undefined,
                staff_tags: f.staff_tags || '',
                preop_notes: f.preop_notes || '',
            }
            await addOtCase(admissionId, payload)
            setF({ surgery_name: '', scheduled_start: '', scheduled_end: '', status: 'planned', surgeon_id: '', anaesthetist_id: '', staff_tags: '', preop_notes: '' })
            await load()
        } catch (e1) {
            setErr(e1?.response?.data?.detail || 'Failed to add OT case')
        }
    }

    const loadAna = async (caseId) => {
        try { const { data } = await getAnaesthesia(caseId); setAna({ ...data, ot_case_id: caseId }) }
        catch { setAna(s => ({ ...s, ot_case_id: caseId })) }
    }

    const saveAna = async (e) => {
        e.preventDefault()
        try {
            const payload = {
                ot_case_id: Number(ana.ot_case_id),
                pre_assessment: ana.pre_assessment || '',
                anaesthesia_type: ana.anaesthesia_type || 'general',
                intraop_monitoring: ana.intraop_monitoring || '',
                drugs_administered: ana.drugs_administered || '',
                post_status: ana.post_status || '',
            }
            await saveAnaesthesia(payload)
            alert('Anaesthesia record saved')
        } catch (e1) {
            alert(e1?.response?.data?.detail || 'Save failed')
        }
    }

    return (
        <div className="space-y-3">
            <form onSubmit={submit} className="rounded-xl border bg-white p-3 grid gap-3 md:grid-cols-4 text-sm">
                <div className="md:col-span-4 font-medium">Schedule Surgery</div>
                <input className="input md:col-span-2" placeholder="Surgery name" value={f.surgery_name} onChange={e => setF(s => ({ ...s, surgery_name: e.target.value }))} />
                <input type="datetime-local" className="input" value={f.scheduled_start} onChange={e => setF(s => ({ ...s, scheduled_start: e.target.value }))} />
                <input type="datetime-local" className="input" value={f.scheduled_end} onChange={e => setF(s => ({ ...s, scheduled_end: e.target.value }))} />
                <select className="input" value={f.status} onChange={e => setF(s => ({ ...s, status: e.target.value }))}>
                    {['planned', 'unplanned', 'cancelled', 'completed'].map(x => <option key={x} value={x}>{x}</option>)}
                </select>
                <input className="input" placeholder="Surgeon user id (optional)" value={f.surgeon_id} onChange={e => setF(s => ({ ...s, surgeon_id: e.target.value }))} />
                <input className="input" placeholder="Anaesthetist user id (optional)" value={f.anaesthetist_id} onChange={e => setF(s => ({ ...s, anaesthetist_id: e.target.value }))} />
                <input className="input md:col-span-2" placeholder="Staff tags (CSV/JSON)" value={f.staff_tags} onChange={e => setF(s => ({ ...s, staff_tags: e.target.value }))} />
                <input className="input md:col-span-4" placeholder="Pre-op notes" value={f.preop_notes} onChange={e => setF(s => ({ ...s, preop_notes: e.target.value }))} />
                <div className="md:col-span-4 flex justify-end"><button className="btn">Add</button></div>
            </form>

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                            <th className="px-3 py-2">Case</th>
                            <th className="px-3 py-2">Schedule</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {(rows || []).map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">{r.surgery_name}</td>
                                <td className="px-3 py-2">
                                    {r.scheduled_start ? new Date(r.scheduled_start).toLocaleString() : '—'} → {r.scheduled_end ? new Date(r.scheduled_end).toLocaleString() : '—'}
                                </td>
                                <td className="px-3 py-2">{r.status}</td>
                                <td className="px-3 py-2">
                                    <button className="btn btn-sm" onClick={() => loadAna(r.id)}>Anaesthesia</button>
                                </td>
                            </tr>
                        ))}
                        {!rows?.length && <tr><td className="p-3 text-sm text-gray-500" colSpan={4}>No OT cases</td></tr>}
                    </tbody>
                </table>
            </div>

            {ana?.ot_case_id && (
                <form onSubmit={saveAna} className="rounded-xl border bg-white p-3 grid gap-3 md:grid-cols-2 text-sm">
                    <div className="md:col-span-2 font-medium">Anaesthesia / Procedural Sedation</div>
                    <textarea className="input" rows={4} placeholder="Pre-assessment" value={ana.pre_assessment} onChange={e => setAna(s => ({ ...s, pre_assessment: e.target.value }))} />
                    <select className="input" value={ana.anaesthesia_type} onChange={e => setAna(s => ({ ...s, anaesthesia_type: e.target.value }))}>
                        {['local', 'regional', 'spinal', 'general'].map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <textarea className="input md:col-span-2" rows={4} placeholder="Intra-op monitoring (JSON/time-series)" value={ana.intraop_monitoring} onChange={e => setAna(s => ({ ...s, intraop_monitoring: e.target.value }))} />
                    <textarea className="input md:col-span-2" rows={3} placeholder="Drugs administered (JSON)" value={ana.drugs_administered} onChange={e => setAna(s => ({ ...s, drugs_administered: e.target.value }))} />
                    <textarea className="input md:col-span-2" rows={3} placeholder="Post status / recovery notes" value={ana.post_status} onChange={e => setAna(s => ({ ...s, post_status: e.target.value }))} />
                    <div className="md:col-span-2 flex justify-end gap-2">
                        <button className="btn">Save Anaesthesia</button>
                    </div>
                </form>
            )}
        </div>
    )
}
