// FILE: src/opd/Visit.jsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { fetchVisit, updateVisit, createFollowup } from '../api/opd'
// import VisitRxTab from './tabs/VisitRxTab'

export default function Visit() {
    const { id } = useParams()
    const visitId = Number(id)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [data, setData] = useState(null)
    const [form, setForm] = useState({
        chief_complaint: '',
        symptoms: '',
        soap_subjective: '',
        soap_objective: '',
        soap_assessment: '',
        plan: '',
    })

    const [fuDate, setFuDate] = useState('')
    const [fuNote, setFuNote] = useState('')
    const [fuSaving, setFuSaving] = useState(false)

    const load = async () => {
        try {
            setLoading(true)
            const { data } = await fetchVisit(visitId)
            setData(data)
            setForm({
                chief_complaint: data.chief_complaint || '',
                symptoms: data.symptoms || '',
                soap_subjective: data.soap_subjective || '',
                soap_objective: data.soap_objective || '',
                soap_assessment: data.soap_assessment || '',
                plan: data.plan || '',
            })
        } catch {
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!visitId) return
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitId])

    const onField = (name, val) =>
        setForm((f) => ({
            ...f,
            [name]: val,
        }))

    const save = async () => {
        try {
            setSaving(true)
            await updateVisit(visitId, form)
            toast.success('Visit updated')
            await load()
        } catch {
            // error toast global
        } finally {
            setSaving(false)
        }
    }

    const formatVisitAt = (iso) => {
        if (!iso) return ''
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return iso
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        })
    }

    const createFu = async () => {
        if (!fuDate) {
            toast.error('Select follow-up date')
            return
        }
        try {
            setFuSaving(true)
            await createFollowup(visitId, {
                due_date: fuDate,
                note: fuNote || undefined,
            })
            toast.success('Follow-up created')
            setFuDate('')
            setFuNote('')
            await load()
        } catch {
            // handled globally
        } finally {
            setFuSaving(false)
        }
    }

    if (!visitId) {
        return <div className="p-4 text-sm">Invalid visit ID.</div>
    }

    if (loading) {
        return <div className="p-4 text-sm text-slate-500">Loading visit…</div>
    }

    if (!data) {
        return <div className="p-4 text-sm text-red-600">Visit not found.</div>
    }

    return (
        <div className="space-y-4 p-4">
            <h1 className="text-xl font-semibold">OPD Visit</h1>

            {/* Header */}
            <div className="rounded-2xl border bg-white p-4 space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                    <div>
                        <div className="font-semibold">
                            {data.patient_name}{' '}
                            <span className="text-[11px] text-slate-500">
                                (UHID {data.uhid})
                            </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                            {data.department_name} · Dr. {data.doctor_name}
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-500 text-right">
                        Episode: {data.episode_id} <br />
                        Visit at: {formatVisitAt(data.visit_at)}
                    </div>
                </div>

                {data.current_vitals && (
                    <div className="rounded-xl border bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                        <div className="font-semibold mb-1">Latest vitals</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {data.current_vitals.height_cm && (
                                <span>Ht: {data.current_vitals.height_cm} cm</span>
                            )}
                            {data.current_vitals.weight_kg && (
                                <span>Wt: {data.current_vitals.weight_kg} kg</span>
                            )}
                            {data.current_vitals.temp_c && (
                                <span>Temp: {data.current_vitals.temp_c} °C</span>
                            )}
                            {data.current_vitals.bp_systolic && (
                                <span>
                                    BP: {data.current_vitals.bp_systolic}/
                                    {data.current_vitals.bp_diastolic} mmHg
                                </span>
                            )}
                            {data.current_vitals.pulse && (
                                <span>Pulse: {data.current_vitals.pulse}</span>
                            )}
                            {data.current_vitals.rr && (
                                <span>RR: {data.current_vitals.rr}</span>
                            )}
                            {data.current_vitals.spo2 && (
                                <span>SpO₂: {data.current_vitals.spo2}%</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* SOAP notes */}
            <div className="rounded-2xl border bg-white p-4 space-y-3">
                <h3 className="font-medium text-sm">Clinical notes (SOAP)</h3>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Chief Complaint</label>
                        <textarea
                            className="input min-h-[60px]"
                            value={form.chief_complaint}
                            onChange={(e) => onField('chief_complaint', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Symptoms</label>
                        <textarea
                            className="input min-h-[60px]"
                            value={form.symptoms}
                            onChange={(e) => onField('symptoms', e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Subjective</label>
                        <textarea
                            className="input min-h-[80px]"
                            value={form.soap_subjective}
                            onChange={(e) => onField('soap_subjective', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Objective</label>
                        <textarea
                            className="input min-h-[80px]"
                            value={form.soap_objective}
                            onChange={(e) => onField('soap_objective', e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Assessment</label>
                        <textarea
                            className="input min-h-[80px]"
                            value={form.soap_assessment}
                            onChange={(e) => onField('soap_assessment', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Plan</label>
                        <textarea
                            className="input min-h-[80px]"
                            value={form.plan}
                            onChange={(e) => onField('plan', e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button className="btn" onClick={save} disabled={saving}>
                        {saving ? 'Saving…' : 'Save notes'}
                    </button>
                </div>
            </div>

            {/* Follow-up creation */}
            <div className="rounded-2xl border bg-white p-4 space-y-3">
                <h3 className="font-medium text-sm">Follow-up</h3>
                <div className="grid gap-3 md:grid-cols-[1fr,2fr,auto] items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Follow-up date</label>
                        <input
                            type="date"
                            className="input"
                            value={fuDate}
                            onChange={(e) => setFuDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Note (optional)</label>
                        <input
                            className="input"
                            value={fuNote}
                            onChange={(e) => setFuNote(e.target.value)}
                            placeholder="Review in 2 weeks / discuss reports…"
                        />
                    </div>
                    <button className="btn" onClick={createFu} disabled={fuSaving}>
                        {fuSaving ? 'Creating…' : 'Create Follow-up'}
                    </button>
                </div>
            </div>

            {/* NEW: OPD Pharmacy Prescriptions */}
            {/* <VisitRxTab visit={data} visitId={visitId} /> */}
        </div>
    )
}
