// src/ris/components/RisOrderForm.jsx
import { useEffect, useState } from 'react'
import { listRisTests, createRisOrder } from '../../api/ris'
import PatientPicker from '../../opd/components/patientPicker'
import { toast } from 'sonner'

export default function RisOrderForm({ onClose, onCreated }) {
    const [patientId, setPatientId] = useState(null)
    const [tests, setTests] = useState([])
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(false)
    const [priority, setPriority] = useState('routine')
    const [testId, setTestId] = useState('')

    useEffect(() => {
        let stop = false
        const run = async () => {
            const { data } = await listRisTests({ q })
            if (!stop) setTests(Array.isArray(data) ? data : (data?.items || []))
        }
        run()
        return () => { stop = true }
    }, [q])

    const submit = async () => {
        if (!patientId) return toast.error('Select a patient')
        if (!testId) return toast.error('Select a test')
        setLoading(true)
        try {
            const { data } = await createRisOrder({ patient_id: patientId, test_id: Number(testId), priority })
            toast.success(`Order #${data?.id} created`)
            onCreated?.(data)
            onClose?.()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to create order')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Create Radiology Order</h3>

            <PatientPicker value={patientId} onChange={setPatientId} />

            <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Test</label>
                    <div className="flex items-center gap-2">
                        <input className="input" placeholder="Search tests…" value={q} onChange={e => setQ(e.target.value)} />
                        <select className="input" value={testId} onChange={e => setTestId(e.target.value)}>
                            <option value="">Select…</option>
                            {tests.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name} {t.modality ? `(${t.modality})` : ''}</option>)}
                        </select>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="stat">STAT</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn" onClick={submit} disabled={loading}>
                    {loading ? 'Creating…' : 'Create Order'}
                </button>
            </div>
        </div>
    )
}
