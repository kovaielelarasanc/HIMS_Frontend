// frontend/src/opd/Schedules.jsx
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
    saveDoctorSchedule,
    fetchDoctorSchedules,
} from '../api/opd'
import DoctorPicker from './components/DoctorPicker'

export default function Schedules() {
    const [doctorId, setDoctorId] = useState(null)
    const [departmentId, setDepartmentId] = useState(null)
    const [weekday, setWeekday] = useState('0')
    const [start, setStart] = useState('09:00')
    const [end, setEnd] = useState('13:00')
    const [list, setList] = useState([])
    const [loading, setLoading] = useState(false)

    const handleDoctorChange = useCallback((id, meta) => {
        setDoctorId(id)
        setDepartmentId(meta?.department_id || null)
    }, [])

    const load = useCallback(async () => {
        if (!doctorId) {
            setList([])
            return
        }
        try {
            setLoading(true)
            const { data } = await fetchDoctorSchedules(doctorId)
            setList(data || [])
        } catch (e) {
            console.error(e)
            toast.error('Failed to load schedules')
        } finally {
            setLoading(false)
        }
    }, [doctorId])

    useEffect(() => {
        load()
    }, [load])

    const add = async (e) => {
        e?.preventDefault?.()
        if (!doctorId) {
            toast.error('Select doctor first')
            return
        }
        try {
            await saveDoctorSchedule({
                doctor_user_id: doctorId,
                weekday: Number(weekday),
                start_time: start,
                end_time: end,
            })
            toast.success('Schedule saved')
            load()
        } catch (e) {
            console.error(e)
            toast.error(
                e?.response?.data?.detail || 'Failed to save schedule',
            )
        }
    }

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-semibold">Doctor Schedules</h1>

            <div className="rounded-2xl border bg-white p-4 space-y-4">
                <DoctorPicker value={doctorId} onChange={handleDoctorChange} />

                <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Weekday</label>
                        <select
                            className="input"
                            value={weekday}
                            onChange={(e) => setWeekday(e.target.value)}
                        >
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                                (d, i) => (
                                    <option key={i} value={i}>
                                        {d}
                                    </option>
                                ),
                            )}
                        </select>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Start</label>
                            <input
                                type="time"
                                className="input"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">End</label>
                            <input
                                type="time"
                                className="input"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"          // 🔴 important: no form submit
                        className="btn"
                        disabled={!doctorId}
                        onClick={add}
                    >
                        Add Slot
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <h3 className="mb-2 font-medium">Existing</h3>
                {loading && <div className="text-sm text-gray-500">Loading…</div>}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((s) => (
                        <div
                            key={`${s.id}`}
                            className="rounded-xl border px-3 py-2 text-sm"
                        >
                            <div className="font-medium">
                                {
                                    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][
                                    s.weekday
                                    ]
                                }{' '}
                                · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                            </div>
                        </div>
                    ))}
                    {!loading && (!list || list.length === 0) && (
                        <div className="text-sm text-gray-500">No schedules yet.</div>
                    )}
                </div>
            </div>
        </div>
    )
}
