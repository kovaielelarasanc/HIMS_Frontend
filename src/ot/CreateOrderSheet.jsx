import { useEffect, useMemo, useState } from 'react'
import { listOtSurgeries, createOtOrder } from '../api/ot'
import PatientPicker from '../opd/components/patientPicker' // you already have this
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Plus } from 'lucide-react'
import { useAuth } from '../store/authStore'

export default function CreateOrderSheet({ open, onClose }) {
    const navigate = useNavigate()
    const user = useAuth(s => s.user)
    const [patientId, setPatientId] = useState(null)
    const [q, setQ] = useState('')
    const [surgeries, setSurgeries] = useState([])
    const [selectedMasterId, setSelectedMasterId] = useState('')
    const [customName, setCustomName] = useState('')
    const [estimatedCost, setEstimatedCost] = useState('')
    const [scheduledStart, setScheduledStart] = useState('')
    const [scheduledEnd, setScheduledEnd] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open) return
        let alive = true
        const run = async () => {
            try {
                const { data } = await listOtSurgeries({ q, page_size: 50, active: true })
                if (!alive) return
                setSurgeries(data?.items || [])
            } catch (e) { /* ignore */ }
        }
        run()
        return () => { alive = false }
    }, [open, q])

    const canSubmit = useMemo(() => {
        return patientId && (selectedMasterId || customName.trim().length > 0)
    }, [patientId, selectedMasterId, customName])

    const onSubmit = async () => {
        if (!canSubmit) return
        setLoading(true)
        try {
            const payload = {
                patient_id: patientId,
                context_type: 'ipd', // or 'opd' if needed
                context_id: null,
                surgery_master_id: selectedMasterId ? Number(selectedMasterId) : null,
                surgery_name: selectedMasterId ? null : customName.trim(),
                estimated_cost: estimatedCost ? Number(estimatedCost) : null,
                surgeon_id: null,
                anaesthetist_id: null,
                scheduled_start: scheduledStart || null,
                scheduled_end: scheduledEnd || null,
                ordering_user_id: user?.id,
            }
            const { data } = await createOtOrder(payload)
            toast.success('OT order created')
            onClose?.()
            navigate(`/ot/orders/${data.id}`)
        } catch (err) {
            const msg = err?.response?.data?.detail || 'Failed to create OT order'
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 grid place-items-end md:place-items-center bg-black/30 backdrop-blur-sm p-3">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
                <header className="flex items-center justify-between border-b p-4">
                    <h3 className="text-lg font-semibold">New OT Order</h3>
                    <button className="btn-ghost" onClick={() => onClose?.()}>Close</button>
                </header>

                <div className="p-4 space-y-5">
                    <PatientPicker value={patientId} onChange={setPatientId} />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Choose Surgery (Master)</label>
                            <input
                                className="input"
                                placeholder="Search master list…"
                                value={q}
                                onChange={e => setQ(e.target.value)}
                            />
                            <select
                                className="input"
                                value={selectedMasterId}
                                onChange={e => setSelectedMasterId(e.target.value)}
                            >
                                <option value="">— Select from master —</option>
                                {surgeries.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.code} — {s.name} ({Number(s.default_cost || 0).toFixed(2)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">OR enter Custom Surgery</label>
                            <input
                                className="input"
                                placeholder="e.g., Laparoscopic Cholecystectomy"
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                disabled={!!selectedMasterId}
                            />
                            <label className="text-sm font-medium">Estimated Cost (optional)</label>
                            <input
                                className="input"
                                type="number"
                                min="0"
                                value={estimatedCost}
                                onChange={e => setEstimatedCost(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium inline-flex items-center gap-2">
                                <CalendarClock className="h-4 w-4" /> Scheduled Start (optional)
                            </label>
                            <input
                                className="input"
                                type="datetime-local"
                                value={scheduledStart}
                                onChange={e => setScheduledStart(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Scheduled End (optional)</label>
                            <input
                                className="input"
                                type="datetime-local"
                                value={scheduledEnd}
                                onChange={e => setScheduledEnd(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <footer className="flex items-center justify-end gap-2 border-t p-4">
                    <button className="btn-ghost" onClick={() => onClose?.()}>Cancel</button>
                    <button className="btn" disabled={!canSubmit || loading} onClick={onSubmit}>
                        <Plus className="h-4 w-4 mr-2" /> Create Order
                    </button>
                </footer>
            </div>
        </div>
    )
}
