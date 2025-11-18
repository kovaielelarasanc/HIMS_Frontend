import { useEffect, useState } from 'react'
import { getDischargeSummary, saveDischargeSummary, getDischargeChecklist, saveDischargeChecklist } from '../../api/ipd'
import PermGate from '../../components/PermGate'

export default function Discharge({ admissionId }) {
    const [sum, setSum] = useState(null)
    const [chk, setChk] = useState(null)
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    const [fs, setFs] = useState({
        demographics: '', medical_history: '', treatment_summary: '',
        medications: '', follow_up: '', icd10_codes: '', finalize: false
    })
    const [fc, setFc] = useState({
        financial_clearance: false, clinical_clearance: false, delay_reason: '', submit: false
    })

    const load = async () => {
        setErr('')
        try {
            const [s, c] = await Promise.all([
                getDischargeSummary(admissionId),
                getDischargeChecklist(admissionId)
            ])
            const sd = s?.data || null
            setSum(sd)
            if (sd) {
                setFs({
                    demographics: sd.demographics || '',
                    medical_history: sd.medical_history || '',
                    treatment_summary: sd.treatment_summary || '',
                    medications: sd.medications || '',
                    follow_up: sd.follow_up || '',
                    icd10_codes: sd.icd10_codes || '',
                    finalize: false, // checkbox is action for this save
                })
            }
            const cd = c?.data || null
            setChk(cd)
            if (cd) {
                setFc({
                    financial_clearance: !!cd.financial_clearance,
                    clinical_clearance: !!cd.clinical_clearance,
                    delay_reason: cd.delay_reason || '',
                    submit: false,
                })
            }
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load discharge data')
        }
    }
    useEffect(() => { load() }, [admissionId])

    const saveSummary = async (e) => {
        e.preventDefault()
        setSaving(true); setErr('')
        try {
            const payload = { ...fs }
            await saveDischargeSummary(admissionId, payload)
            await load()
        } catch (e1) {
            setErr(e1?.response?.data?.detail || 'Failed to save summary')
        } finally { setSaving(false) }
    }

    const saveChecklist = async (e) => {
        e.preventDefault()
        setSaving(true); setErr('')
        try {
            await saveDischargeChecklist(admissionId, { ...fc })
            await load()
        } catch (e1) {
            setErr(e1?.response?.data?.detail || 'Failed to save checklist')
        } finally { setSaving(false) }
    }

    const finalized = !!sum?.finalized

    return (
        <div className="space-y-4">
            <PermGate anyOf={['ipd.manage']}>
                {/* Summary */}
                <form onSubmit={saveSummary} className="rounded-xl border bg-white p-3 grid gap-3 md:grid-cols-2 text-sm">
                    <div className="md:col-span-2 font-medium">Discharge Summary</div>
                    <textarea className="input" rows={2} placeholder="Patient demographics" value={fs.demographics} onChange={e => setFs(s => ({ ...s, demographics: e.target.value }))} disabled={finalized} />
                    <textarea className="input" rows={2} placeholder="Medical history" value={fs.medical_history} onChange={e => setFs(s => ({ ...s, medical_history: e.target.value }))} disabled={finalized} />
                    <textarea className="input md:col-span-2" rows={3} placeholder="Treatment summary" value={fs.treatment_summary} onChange={e => setFs(s => ({ ...s, treatment_summary: e.target.value }))} disabled={finalized} />
                    <textarea className="input" rows={2} placeholder="Medications" value={fs.medications} onChange={e => setFs(s => ({ ...s, medications: e.target.value }))} disabled={finalized} />
                    <textarea className="input" rows={2} placeholder="Follow-up" value={fs.follow_up} onChange={e => setFs(s => ({ ...s, follow_up: e.target.value }))} disabled={finalized} />
                    <input className="input md:col-span-2" placeholder="ICD-10 codes (CSV/JSON)" value={fs.icd10_codes} onChange={e => setFs(s => ({ ...s, icd10_codes: e.target.value }))} disabled={finalized} />

                    <div className="md:col-span-2 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                            {finalized ? `Finalized at ${sum?.finalized_at ? new Date(sum.finalized_at).toLocaleString() : ''}` : 'Fill mandatory fields before finalizing'}
                        </div>
                        <div className="flex items-center gap-3">
                            {!finalized && (
                                <label className="inline-flex items-center gap-2">
                                    <input type="checkbox" className="h-4 w-4" checked={fs.finalize} onChange={e => setFs(s => ({ ...s, finalize: e.target.checked }))} />
                                    <span>Finalize</span>
                                </label>
                            )}
                            <button className="btn" disabled={saving || finalized}>Save</button>
                        </div>
                    </div>
                    {err && <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700">{err}</div>}
                </form>

                {/* Checklist */}
                <form onSubmit={saveChecklist} className="rounded-xl border bg-white p-3 grid gap-3 md:grid-cols-2 text-sm">
                    <div className="md:col-span-2 font-medium">Discharge Checklist & Clearance</div>
                    <label className="inline-flex items-center gap-2">
                        <input type="checkbox" className="h-4 w-4" checked={fc.financial_clearance} onChange={e => setFc(s => ({ ...s, financial_clearance: e.target.checked }))} />
                        <span>Financial clearance</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                        <input type="checkbox" className="h-4 w-4" checked={fc.clinical_clearance} onChange={e => setFc(s => ({ ...s, clinical_clearance: e.target.checked }))} />
                        <span>Clinical clearance</span>
                    </label>
                    <input className="input md:col-span-2" placeholder="Delay reason (if any)" value={fc.delay_reason} onChange={e => setFc(s => ({ ...s, delay_reason: e.target.value }))} />
                    <div className="md:col-span-2 flex items-center justify-between">
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" className="h-4 w-4" checked={fc.submit} onChange={e => setFc(s => ({ ...s, submit: e.target.checked }))} />
                            <span>Submit checklist</span>
                        </label>
                        <button className="btn" disabled={saving}>Save</button>
                    </div>
                    {chk?.submitted && (
                        <div className="md:col-span-2 text-xs text-emerald-700">
                            Submitted at {chk?.submitted_at ? new Date(chk.submitted_at).toLocaleString() : ''}
                        </div>
                    )}
                </form>
            </PermGate>
        </div>
    )
}
