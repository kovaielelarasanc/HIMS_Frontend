// FILE: src/ipd/tabs/Assessments.jsx
import { useEffect, useState } from 'react'
import {
    listPainAssessments,
    addPainAssessment,
    listFallRiskAssessments,
    addFallRiskAssessment,
    listPressureUlcerAssessments,
    addPressureUlcerAssessment,
    listNutritionAssessments,
    addNutritionAssessment,
} from '../../api/ipd'

const toIsoSecs = (v) =>
    !v ? null : v.length === 16 ? `${v}:00` : v

export default function AssessmentsTab({ admissionId, canWrite }) {
    const [active, setActive] = useState('pain')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [painRows, setPainRows] = useState([])
    const [fallRows, setFallRows] = useState([])
    const [pressureRows, setPressureRows] = useState([])
    const [nutritionRows, setNutritionRows] = useState([])

    const [painForm, setPainForm] = useState({
        recorded_at: '',
        scale_type: '',
        score: '',
        location: '',
        character: '',
        intervention: '',
        post_intervention_score: '',
    })

    const [fallForm, setFallForm] = useState({
        recorded_at: '',
        tool: '',
        score: '',
        risk_level: '',
        precautions: '',
    })

    const [pressureForm, setPressureForm] = useState({
        recorded_at: '',
        tool: '',
        score: '',
        risk_level: '',
        existing_ulcer: false,
        site: '',
        stage: '',
        management_plan: '',
    })

    const [nutritionForm, setNutritionForm] = useState({
        recorded_at: '',
        bmi: '',
        weight_kg: '',
        height_cm: '',
        screening_tool: '',
        score: '',
        risk_level: '',
        dietician_referral: false,
    })

    const loadAll = async () => {
        if (!admissionId) return
        setLoading(true)
        setError('')
        try {
            const [p, f, pr, n] = await Promise.all([
                listPainAssessments(admissionId),
                listFallRiskAssessments(admissionId),
                listPressureUlcerAssessments(admissionId),
                listNutritionAssessments(admissionId),
            ])
            setPainRows(p.data || [])
            setFallRows(f.data || [])
            setPressureRows(pr.data || [])
            setNutritionRows(n.data || [])
        } catch (e) {
            setError(e?.response?.data?.detail || 'Failed to load assessments')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    const submitPain = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return
        try {
            const payload = {
                recorded_at: toIsoSecs(painForm.recorded_at),
                scale_type: painForm.scale_type || '',
                score: painForm.score !== '' ? Number(painForm.score) : null,
                location: painForm.location || '',
                character: painForm.character || '',
                intervention: painForm.intervention || '',
                post_intervention_score:
                    painForm.post_intervention_score !== ''
                        ? Number(painForm.post_intervention_score)
                        : null,
            }
            await addPainAssessment(admissionId, payload)
            setPainForm({
                recorded_at: '',
                scale_type: '',
                score: '',
                location: '',
                character: '',
                intervention: '',
                post_intervention_score: '',
            })
            await loadAll()
        } catch (e1) {
            alert(e1?.response?.data?.detail || 'Failed to add pain assessment')
        }
    }

    const submitFall = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return
        try {
            const payload = {
                recorded_at: toIsoSecs(fallForm.recorded_at),
                tool: fallForm.tool || '',
                score: fallForm.score !== '' ? Number(fallForm.score) : null,
                risk_level: fallForm.risk_level || '',
                precautions: fallForm.precautions || '',
            }
            await addFallRiskAssessment(admissionId, payload)
            setFallForm({
                recorded_at: '',
                tool: '',
                score: '',
                risk_level: '',
                precautions: '',
            })
            await loadAll()
        } catch (e1) {
            alert(e1?.response?.data?.detail || 'Failed to add fall risk assessment')
        }
    }

    const submitPressure = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return
        try {
            const payload = {
                recorded_at: toIsoSecs(pressureForm.recorded_at),
                tool: pressureForm.tool || '',
                score: pressureForm.score !== '' ? Number(pressureForm.score) : null,
                risk_level: pressureForm.risk_level || '',
                existing_ulcer: Boolean(pressureForm.existing_ulcer),
                site: pressureForm.site || '',
                stage: pressureForm.stage || '',
                management_plan: pressureForm.management_plan || '',
            }
            await addPressureUlcerAssessment(admissionId, payload)
            setPressureForm({
                recorded_at: '',
                tool: '',
                score: '',
                risk_level: '',
                existing_ulcer: false,
                site: '',
                stage: '',
                management_plan: '',
            })
            await loadAll()
        } catch (e1) {
            alert(
                e1?.response?.data?.detail || 'Failed to add pressure-ulcer assessment'
            )
        }
    }

    const submitNutrition = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return
        try {
            const payload = {
                recorded_at: toIsoSecs(nutritionForm.recorded_at),
                bmi:
                    nutritionForm.bmi !== ''
                        ? Number(nutritionForm.bmi)
                        : null,
                weight_kg:
                    nutritionForm.weight_kg !== ''
                        ? Number(nutritionForm.weight_kg)
                        : null,
                height_cm:
                    nutritionForm.height_cm !== ''
                        ? Number(nutritionForm.height_cm)
                        : null,
                screening_tool: nutritionForm.screening_tool || '',
                score:
                    nutritionForm.score !== ''
                        ? Number(nutritionForm.score)
                        : null,
                risk_level: nutritionForm.risk_level || '',
                dietician_referral: Boolean(nutritionForm.dietician_referral),
            }
            await addNutritionAssessment(admissionId, payload)
            setNutritionForm({
                recorded_at: '',
                bmi: '',
                weight_kg: '',
                height_cm: '',
                screening_tool: '',
                score: '',
                risk_level: '',
                dietician_referral: false,
            })
            await loadAll()
        } catch (e1) {
            alert(
                e1?.response?.data?.detail || 'Failed to add nutrition assessment'
            )
        }
    }

    const tabs = [
        { key: 'pain', label: 'Pain' },
        { key: 'fall', label: 'Fall Risk' },
        { key: 'pressure', label: 'Pressure Ulcer' },
        { key: 'nutrition', label: 'Nutrition' },
    ]

    return (
        <div className="space-y-4 text-sm text-black">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold">Risk & Clinical Assessments</h2>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setActive(t.key)}
                        className={[
                            'rounded-full px-3 py-1 text-xs md:text-sm border',
                            active === t.key
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-500 hover:bg-slate-50',
                        ].join(' ')}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="text-xs text-gray-500">
                    Loading assessments…
                </div>
            )}

            {/* PAIN */}
            {active === 'pain' && (
                <section className="space-y-3">
                    {canWrite && (
                        <form
                            onSubmit={submitPain}
                            className="rounded-xl border bg-gray-50 p-3 space-y-3"
                        >
                            <div className="grid gap-3 md:grid-cols-4">
                                <div>
                                    <label className="text-xs text-gray-500">Recorded at</label>
                                    <input
                                        type="datetime-local"
                                        className="input"
                                        value={painForm.recorded_at}
                                        onChange={(e) =>
                                            setPainForm((s) => ({ ...s, recorded_at: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Scale</label>
                                    <input
                                        className="input"
                                        placeholder="NRS / VAS / Wong-Baker"
                                        value={painForm.scale_type}
                                        onChange={(e) =>
                                            setPainForm((s) => ({ ...s, scale_type: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Score</label>
                                    <input
                                        className="input"
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={painForm.score}
                                        onChange={(e) =>
                                            setPainForm((s) => ({ ...s, score: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Location</label>
                                    <input
                                        className="input"
                                        placeholder="Site"
                                        value={painForm.location}
                                        onChange={(e) =>
                                            setPainForm((s) => ({ ...s, location: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <label className="text-xs text-gray-500">Character</label>
                                    <input
                                        className="input"
                                        placeholder="sharp / dull / throbbing"
                                        value={painForm.character}
                                        onChange={(e) =>
                                            setPainForm((s) => ({ ...s, character: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Post-intervention score</label>
                                    <input
                                        className="input"
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={painForm.post_intervention_score}
                                        onChange={(e) =>
                                            setPainForm((s) => ({
                                                ...s,
                                                post_intervention_score: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <textarea
                                className="input min-h-[70px]"
                                placeholder="Interventions / remarks"
                                value={painForm.intervention}
                                onChange={(e) =>
                                    setPainForm((s) => ({ ...s, intervention: e.target.value }))
                                }
                            />

                            <div className="flex justify-end">
                                <button className="btn">Save pain assessment</button>
                            </div>
                        </form>
                    )}

                    <div className="rounded-xl border bg-white overflow-hidden">
                        <table className="w-full text-xs md:text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-[11px] md:text-xs">
                                    <th className="px-2 md:px-3 py-2">When</th>
                                    <th className="px-2 md:px-3 py-2">Scale</th>
                                    <th className="px-2 md:px-3 py-2">Score</th>
                                    <th className="px-2 md:px-3 py-2">Location / Character</th>
                                    <th className="px-2 md:px-3 py-2">Intervention</th>
                                </tr>
                            </thead>
                            <tbody>
                                {painRows.map((r) => (
                                    <tr key={r.id} className="border-t align-top">
                                        <td className="px-2 md:px-3 py-2">
                                            {r.recorded_at
                                                ? new Date(r.recorded_at).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="px-2 md:px-3 py-2">
                                            {r.scale_type || '—'}
                                        </td>
                                        <td className="px-2 md:px-3 py-2">
                                            {r.score ?? '—'}
                                        </td>
                                        <td className="px-2 md:px-3 py-2 whitespace-pre-wrap">
                                            {r.location || '—'}
                                            {r.character ? ` (${r.character})` : ''}
                                        </td>
                                        <td className="px-2 md:px-3 py-2 whitespace-pre-wrap">
                                            {r.intervention || '—'}
                                        </td>
                                    </tr>
                                ))}
                                {!painRows.length && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-3 text-gray-500 text-xs"
                                        >
                                            No pain assessments recorded.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* FALL RISK */}
            {active === 'fall' && (
                <section className="space-y-3">
                    {canWrite && (
                        <form
                            onSubmit={submitFall}
                            className="rounded-xl border bg-gray-50 p-3 space-y-3"
                        >
                            <div className="grid gap-3 md:grid-cols-4">
                                <div>
                                    <label className="text-xs text-gray-500">Recorded at</label>
                                    <input
                                        type="datetime-local"
                                        className="input"
                                        value={fallForm.recorded_at}
                                        onChange={(e) =>
                                            setFallForm((s) => ({ ...s, recorded_at: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Tool</label>
                                    <input
                                        className="input"
                                        placeholder="Morse, etc."
                                        value={fallForm.tool}
                                        onChange={(e) =>
                                            setFallForm((s) => ({ ...s, tool: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Score</label>
                                    <input
                                        className="input"
                                        type="number"
                                        value={fallForm.score}
                                        onChange={(e) =>
                                            setFallForm((s) => ({ ...s, score: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Risk level</label>
                                    <input
                                        className="input"
                                        placeholder="low / moderate / high"
                                        value={fallForm.risk_level}
                                        onChange={(e) =>
                                            setFallForm((s) => ({
                                                ...s,
                                                risk_level: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <textarea
                                className="input min-h-[70px]"
                                placeholder="Precautions / instructions"
                                value={fallForm.precautions}
                                onChange={(e) =>
                                    setFallForm((s) => ({ ...s, precautions: e.target.value }))
                                }
                            />
                            <div className="flex justify-end">
                                <button className="btn">Save fall risk assessment</button>
                            </div>
                        </form>
                    )}

                    <div className="rounded-xl border bg-white overflow-hidden">
                        <table className="w-full text-xs md:text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-[11px] md:text-xs">
                                    <th className="px-2 md:px-3 py-2">When</th>
                                    <th className="px-2 md:px-3 py-2">Tool</th>
                                    <th className="px-2 md:px-3 py-2">Score</th>
                                    <th className="px-2 md:px-3 py-2">Risk</th>
                                    <th className="px-2 md:px-3 py-2">Precautions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fallRows.map((r) => (
                                    <tr key={r.id} className="border-t align-top">
                                        <td className="px-2 md:px-3 py-2">
                                            {r.recorded_at
                                                ? new Date(r.recorded_at).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="px-2 md:px-3 py-2">{r.tool || '—'}</td>
                                        <td className="px-2 md:px-3 py-2">{r.score ?? '—'}</td>
                                        <td className="px-2 md:px-3 py-2">
                                            {r.risk_level || '—'}
                                        </td>
                                        <td className="px-2 md:px-3 py-2 whitespace-pre-wrap">
                                            {r.precautions || '—'}
                                        </td>
                                    </tr>
                                ))}
                                {!fallRows.length && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-3 text-gray-500 text-xs"
                                        >
                                            No fall risk assessments recorded.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* PRESSURE ULCER */}
            {active === 'pressure' && (
                <section className="space-y-3">
                    {canWrite && (
                        <form
                            onSubmit={submitPressure}
                            className="rounded-xl border bg-gray-50 p-3 space-y-3"
                        >
                            <div className="grid gap-3 md:grid-cols-4">
                                <div>
                                    <label className="text-xs text-gray-500">Recorded at</label>
                                    <input
                                        type="datetime-local"
                                        className="input"
                                        value={pressureForm.recorded_at}
                                        onChange={(e) =>
                                            setPressureForm((s) => ({
                                                ...s,
                                                recorded_at: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Tool</label>
                                    <input
                                        className="input"
                                        placeholder="Braden, etc."
                                        value={pressureForm.tool}
                                        onChange={(e) =>
                                            setPressureForm((s) => ({ ...s, tool: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Score</label>
                                    <input
                                        className="input"
                                        type="number"
                                        value={pressureForm.score}
                                        onChange={(e) =>
                                            setPressureForm((s) => ({ ...s, score: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">
                                        Risk level
                                    </label>
                                    <input
                                        className="input"
                                        placeholder="low / moderate / high"
                                        value={pressureForm.risk_level}
                                        onChange={(e) =>
                                            setPressureForm((s) => ({
                                                ...s,
                                                risk_level: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <label className="flex items-center gap-2 text-xs text-gray-700">
                                    <input
                                        type="checkbox"
                                        className="h-3 w-3"
                                        checked={Boolean(pressureForm.existing_ulcer)}
                                        onChange={(e) =>
                                            setPressureForm((s) => ({
                                                ...s,
                                                existing_ulcer: e.target.checked,
                                            }))
                                        }
                                    />
                                    Existing ulcer
                                </label>
                                <div>
                                    <label className="text-xs text-gray-500">Site</label>
                                    <input
                                        className="input"
                                        value={pressureForm.site}
                                        onChange={(e) =>
                                            setPressureForm((s) => ({ ...s, site: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Stage</label>
                                    <input
                                        className="input"
                                        placeholder="Stage I–IV"
                                        value={pressureForm.stage}
                                        onChange={(e) =>
                                            setPressureForm((s) => ({ ...s, stage: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>

                            <textarea
                                className="input min-h-[70px]"
                                placeholder="Management plan"
                                value={pressureForm.management_plan}
                                onChange={(e) =>
                                    setPressureForm((s) => ({
                                        ...s,
                                        management_plan: e.target.value,
                                    }))
                                }
                            />
                            <div className="flex justify-end">
                                <button className="btn">
                                    Save pressure-ulcer assessment
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="rounded-xl border bg-white overflow-hidden">
                        <table className="w-full text-xs md:text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-[11px] md:text-xs">
                                    <th className="px-2 md:px-3 py-2">When</th>
                                    <th className="px-2 md:px-3 py-2">Tool</th>
                                    <th className="px-2 md:px-3 py-2">Score</th>
                                    <th className="px-2 md:px-3 py-2">Risk / Site / Stage</th>
                                    <th className="px-2 md:px-3 py-2">Management plan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pressureRows.map((r) => (
                                    <tr key={r.id} className="border-t align-top">
                                        <td className="px-2 md:px-3 py-2">
                                            {r.recorded_at
                                                ? new Date(r.recorded_at).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="px-2 md:px-3 py-2">{r.tool || '—'}</td>
                                        <td className="px-2 md:px-3 py-2">{r.score ?? '—'}</td>
                                        <td className="px-2 md:px-3 py-2 whitespace-pre-wrap">
                                            {r.risk_level || '—'}
                                            {r.site ? ` • ${r.site}` : ''}
                                            {r.stage ? ` (Stage ${r.stage})` : ''}
                                            {r.existing_ulcer ? ' • Existing' : ''}
                                        </td>
                                        <td className="px-2 md:px-3 py-2 whitespace-pre-wrap">
                                            {r.management_plan || '—'}
                                        </td>
                                    </tr>
                                ))}
                                {!pressureRows.length && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-3 text-gray-500 text-xs"
                                        >
                                            No pressure-ulcer assessments recorded.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* NUTRITION */}
            {active === 'nutrition' && (
                <section className="space-y-3">
                    {canWrite && (
                        <form
                            onSubmit={submitNutrition}
                            className="rounded-xl border bg-gray-50 p-3 space-y-3"
                        >
                            <div className="grid gap-3 md:grid-cols-4">
                                <div>
                                    <label className="text-xs text-gray-500">Recorded at</label>
                                    <input
                                        type="datetime-local"
                                        className="input"
                                        value={nutritionForm.recorded_at}
                                        onChange={(e) =>
                                            setNutritionForm((s) => ({
                                                ...s,
                                                recorded_at: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">BMI</label>
                                    <input
                                        className="input"
                                        type="number"
                                        step="0.1"
                                        value={nutritionForm.bmi}
                                        onChange={(e) =>
                                            setNutritionForm((s) => ({ ...s, bmi: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Weight (kg)</label>
                                    <input
                                        className="input"
                                        type="number"
                                        step="0.1"
                                        value={nutritionForm.weight_kg}
                                        onChange={(e) =>
                                            setNutritionForm((s) => ({
                                                ...s,
                                                weight_kg: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Height (cm)</label>
                                    <input
                                        className="input"
                                        type="number"
                                        step="0.1"
                                        value={nutritionForm.height_cm}
                                        onChange={(e) =>
                                            setNutritionForm((s) => ({
                                                ...s,
                                                height_cm: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div>
                                    <label className="text-xs text-gray-500">Screening tool</label>
                                    <input
                                        className="input"
                                        placeholder="MUST, etc."
                                        value={nutritionForm.screening_tool}
                                        onChange={(e) =>
                                            setNutritionForm((s) => ({
                                                ...s,
                                                screening_tool: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Score</label>
                                    <input
                                        className="input"
                                        type="number"
                                        value={nutritionForm.score}
                                        onChange={(e) =>
                                            setNutritionForm((s) => ({
                                                ...s,
                                                score: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Risk level</label>
                                    <input
                                        className="input"
                                        placeholder="low / moderate / high"
                                        value={nutritionForm.risk_level}
                                        onChange={(e) =>
                                            setNutritionForm((s) => ({
                                                ...s,
                                                risk_level: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-xs text-gray-700">
                                <input
                                    type="checkbox"
                                    className="h-3 w-3"
                                    checked={Boolean(nutritionForm.dietician_referral)}
                                    onChange={(e) =>
                                        setNutritionForm((s) => ({
                                            ...s,
                                            dietician_referral: e.target.checked,
                                        }))
                                    }
                                />
                                Dietician referral required
                            </label>

                            <div className="flex justify-end">
                                <button className="btn">Save nutrition assessment</button>
                            </div>
                        </form>
                    )}

                    <div className="rounded-xl border bg-white overflow-hidden">
                        <table className="w-full text-xs md:text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-[11px] md:text-xs">
                                    <th className="px-2 md:px-3 py-2">When</th>
                                    <th className="px-2 md:px-3 py-2">BMI</th>
                                    <th className="px-2 md:px-3 py-2">Wt / Ht</th>
                                    <th className="px-2 md:px-3 py-2">Tool / Score / Risk</th>
                                    <th className="px-2 md:px-3 py-2">Dietician referral</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nutritionRows.map((r) => (
                                    <tr key={r.id} className="border-t align-top">
                                        <td className="px-2 md:px-3 py-2">
                                            {r.recorded_at
                                                ? new Date(r.recorded_at).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="px-2 md:px-3 py-2">
                                            {r.bmi != null ? String(r.bmi) : '—'}
                                        </td>
                                        <td className="px-2 md:px-3 py-2">
                                            {r.weight_kg != null ? `${r.weight_kg} kg` : '—'}
                                            {r.height_cm != null ? ` / ${r.height_cm} cm` : ''}
                                        </td>
                                        <td className="px-2 md:px-3 py-2 whitespace-pre-wrap">
                                            {r.screening_tool || '—'}
                                            {r.score != null ? ` • Score ${r.score}` : ''}
                                            {r.risk_level ? ` • ${r.risk_level}` : ''}
                                        </td>
                                        <td className="px-2 md:px-3 py-2">
                                            {r.dietician_referral ? 'Yes' : 'No'}
                                        </td>
                                    </tr>
                                ))}
                                {!nutritionRows.length && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-3 text-gray-500 text-xs"
                                        >
                                            No nutrition assessments recorded.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    )
}
