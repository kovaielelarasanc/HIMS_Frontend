import { useEffect, useState } from 'react'
import {
    getAdmissionFeedback,
    saveAdmissionFeedback,
} from '../../api/ipd'

export default function FeedbackTab({ admissionId, canWrite }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [form, setForm] = useState({
        rating_nursing: 5,
        rating_doctor: 5,
        rating_cleanliness: 5,
        comments: '',
        suggestions: '',
    })

    const load = async () => {
        if (!admissionId) return
        setLoading(true)
        setErr('')
        try {
            const { data } = await getAdmissionFeedback(admissionId)
            setData(data || null)
            if (data) {
                setForm({
                    rating_nursing: data.rating_nursing ?? 5,
                    rating_doctor: data.rating_doctor ?? 5,
                    rating_cleanliness: data.rating_cleanliness ?? 5,
                    comments: data.comments || '',
                    suggestions: data.suggestions || '',
                })
            }
        } catch (e) {
            // if no feedback yet, backend can 404; that's ok
            const s = e?.response?.status
            if (s && s !== 404) {
                setErr(e?.response?.data?.detail || 'Failed to load feedback')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    const submit = async (e) => {
        e.preventDefault()
        if (!canWrite || !admissionId) return
        try {
            const payload = {
                rating_nursing: Number(form.rating_nursing) || 0,
                rating_doctor: Number(form.rating_doctor) || 0,
                rating_cleanliness: Number(form.rating_cleanliness) || 0,
                comments: form.comments || '',
                suggestions: form.suggestions || '',
            }
            const { data } = await saveAdmissionFeedback(admissionId, payload)
            setData(data || payload)
            alert('Feedback saved')
        } catch (e1) {
            alert(e1?.response?.data?.detail || 'Failed to save feedback')
        }
    }

    const RatingSelect = ({ label, value, onChange, disabled }) => (
        <div>
            <label className="text-xs text-gray-500">{label}</label>
            <select
                className="input"
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(Number(e.target.value))}
            >
                {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                        {n} / 5
                    </option>
                ))}
            </select>
        </div>
    )

    const readOnly = !canWrite

    return (
        <div className="space-y-4 text-sm text-black">
            <h2 className="font-semibold">Patient Feedback</h2>

            <p className="text-xs text-gray-600">
                Capture patient or attendant feedback for this admission (NABH
                requirement – patient satisfaction).
            </p>

            {loading && (
                <div className="text-xs text-gray-500">Loading…</div>
            )}

            {err && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {err}
                </div>
            )}

            <form
                onSubmit={submit}
                className="rounded-xl border bg-gray-50 p-3 space-y-3"
            >
                <div className="grid gap-3 md:grid-cols-3">
                    <RatingSelect
                        label="Nursing care"
                        value={form.rating_nursing}
                        disabled={readOnly}
                        onChange={(v) =>
                            setForm((s) => ({ ...s, rating_nursing: v }))
                        }
                    />
                    <RatingSelect
                        label="Doctor communication"
                        value={form.rating_doctor}
                        disabled={readOnly}
                        onChange={(v) =>
                            setForm((s) => ({ ...s, rating_doctor: v }))
                        }
                    />
                    <RatingSelect
                        label="Cleanliness / facilities"
                        value={form.rating_cleanliness}
                        disabled={readOnly}
                        onChange={(v) =>
                            setForm((s) => ({ ...s, rating_cleanliness: v }))
                        }
                    />
                </div>

                <textarea
                    className="input min-h-[80px]"
                    placeholder="Comments"
                    value={form.comments}
                    disabled={readOnly}
                    onChange={(e) =>
                        setForm((s) => ({ ...s, comments: e.target.value }))
                    }
                />

                <textarea
                    className="input min-h-[60px]"
                    placeholder="Suggestions for improvement"
                    value={form.suggestions}
                    disabled={readOnly}
                    onChange={(e) =>
                        setForm((s) => ({ ...s, suggestions: e.target.value }))
                    }
                />

                {canWrite && (
                    <div className="flex justify-end">
                        <button className="btn">Save feedback</button>
                    </div>
                )}
            </form>

            {data && (
                <div className="rounded-xl border bg-white p-3 text-xs text-gray-700">
                    <div className="font-semibold mb-1">Snapshot</div>
                    <div>
                        Nursing care: <b>{data.rating_nursing}/5</b>, Doctor:{' '}
                        <b>{data.rating_doctor}/5</b>, Cleanliness:{' '}
                        <b>{data.rating_cleanliness}/5</b>
                    </div>
                    {data.comments && (
                        <div className="mt-1">
                            <span className="font-semibold">Comments:</span>{' '}
                            {data.comments}
                        </div>
                    )}
                    {data.suggestions && (
                        <div className="mt-1">
                            <span className="font-semibold">Suggestions:</span>{' '}
                            {data.suggestions}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
