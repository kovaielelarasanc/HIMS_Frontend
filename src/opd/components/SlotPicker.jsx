import { useEffect, useMemo, useState } from 'react'
import { getFreeSlots } from '../../api/opd'
import { useToast } from '../../components/Toast'

export default function SlotPicker({ doctor_user_id, date, value, onChange }) {
    const [slots, setSlots] = useState([])
    const [loading, setLoading] = useState(false)
    const toast = useToast()

    useEffect(() => {
        let alive = true
        if (!doctor_user_id || !date) { setSlots([]); return }
        setLoading(true)
        getFreeSlots(doctor_user_id, date).then(({ data }) => {
            if (!alive) return
            const raw = data?.slots ?? data ?? []
            const norm = raw.map(s => (typeof s === 'string' ? { start: s, end: '', status: 'free' } : { start: s.start, end: s.end || '', status: s.status || 'free' }))
            setSlots(norm)
        }).finally(() => setLoading(false))
        return () => { alive = false }
    }, [doctor_user_id, date])

    const selectedText = useMemo(() => value || '', [value])

    const pick = (s) => {
        if (s.status !== 'free') {
            if (s.status === 'booked') toast.warn(`Slot ${s.start} is already booked`)
            else if (s.status === 'past') toast.warn(`Slot ${s.start} has already passed`)
            else toast.warn(`Slot ${s.start} is not available`)
            return
        }
        onChange?.(s.start)
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Time Slot</label>
            {loading && <div className="text-sm text-gray-500">Finding free slots…</div>}
            <div className="flex flex-wrap gap-2">
                {slots.map(s => (
                    <button
                        key={s.start}
                        type="button"
                        onClick={() => pick(s)}
                        disabled={s.status !== 'free'}
                        className={[
                            "px-3 py-1.5 rounded-xl border text-sm transition",
                            s.status !== 'free' ? "opacity-40 cursor-not-allowed" :
                                (s.start === value ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50")
                        ].join(' ')}
                        title={s.status}
                    >
                        {s.start}
                    </button>
                ))}
                {!loading && slots.length === 0 && (
                    <div className="text-sm text-gray-500">No free slots.</div>
                )}
            </div>
            {selectedText && (
                <div className="rounded-xl border bg-blue-50 px-3 py-2 text-sm">
                    Selected: <span className="font-medium">{selectedText}</span>
                </div>
            )}
        </div>
    )
}
