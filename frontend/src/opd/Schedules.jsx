import { useEffect, useState } from 'react'
import { saveDoctorSchedule, fetchDoctorSchedules } from '../api/opd'
import DoctorPicker from './components/DoctorPicker'

export default function Schedules() {
    const [doctorId, setDoctorId] = useState(null)
    const [weekday, setWeekday] = useState('0')
    const [start, setStart] = useState('09:00')
    const [end, setEnd] = useState('13:00')
    const [list, setList] = useState([])
    const [msg, setMsg] = useState('')

    const load = async () => {
        if (!doctorId) { setList([]); return }
        const { data } = await fetchDoctorSchedules(doctorId)
        setList(data || [])
    }

    useEffect(() => { load() }, [doctorId])

    const add = async (e) => {
        e.preventDefault()
        setMsg('')
        await saveDoctorSchedule({
            doctor_user_id: doctorId,
            weekday: Number(weekday),
            start_time: start, end_time: end,
        })
        setMsg('Saved.')
        load()
    }

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-semibold">Doctor Schedules</h1>
            <div className="rounded-2xl border bg-white p-4">
                <div className="grid gap-3 md:grid-cols-3">
                    <DoctorPicker value={doctorId} onChange={setDoctorId} />
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Weekday</label>
                        <select className="input" value={weekday} onChange={e => setWeekday(e.target.value)}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Start</label>
                            <input type="time" className="input" value={start} onChange={e => setStart(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">End</label>
                            <input type="time" className="input" value={end} onChange={e => setEnd(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className="mt-3 flex justify-end">
                    <button className="btn" disabled={!doctorId} onClick={add}>Add Slot</button>
                </div>
                {msg && <div className="mt-2 text-sm text-emerald-600">{msg}</div>}
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <h3 className="mb-2 font-medium">Existing</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map(s => (
                        <div key={`${s.weekday}-${s.start_time}`} className="rounded-xl border px-3 py-2 text-sm">
                            <div className="font-medium">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][s.weekday]} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                            </div>
                        </div>
                    ))}
                    {(!list || list.length === 0) && <div className="text-sm text-gray-500">No schedules yet.</div>}
                </div>
            </div>
        </div>
    )
}
