// src/pharmacy/Dispense.jsx
import { useEffect, useState } from 'react'
import { listMedicines, listLocations, dispense, getActiveContext, listPrescriptions } from '../api/pharmacy'
import { Plus, Minus } from 'lucide-react'
import PatientPicker from '../opd/components/patientpicker'
import PermGate from '../components/PermGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectItem, SelectContent, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function Dispense() {
    const [patientId, setPatientId] = useState(null)
    const [context, setContext] = useState(null) // {type:'opd'|'ipd', visit_id|admission_id}
    const [locations, setLocations] = useState([])
    const [locationId, setLocationId] = useState('')
    const [meds, setMeds] = useState([])
    const [items, setItems] = useState([])
    const [submitting, setSubmitting] = useState(false)
    const [rxItems, setRxItems] = useState([])

    // lookups
    useEffect(() => {
        let alive = true
            ; (async () => {
                try {
                    const [l, m] = await Promise.all([
                        listLocations().then(r => r.data || []),
                        listMedicines({ limit: 500, is_active: true }).then(r => r.data || []),
                    ])
                    if (!alive) return
                    setLocations(l)
                    setMeds(m)
                } catch (e) {
                    const msg = e?.response?.data?.detail || 'Please refresh and try again.'
                    toast.error('Failed to load locations/medicines', { description: msg })
                }
            })()
        return () => { alive = false }
    }, [])

    // auto-detect OPD/IPD context for selected patient
    useEffect(() => {
        let alive = true
        if (!patientId) return setContext(null)
            ; (async () => {
                try {
                    const ctx = await getActiveContext(patientId)
                    if (!alive) return
                    setContext(ctx || null)
                } catch {
                    setContext(null)
                }
            })()
        return () => { alive = false }
    }, [patientId])

    // load in-progress Rx items for patient (to link dispensing back to Rx)
    useEffect(() => {
        let alive = true
        if (!patientId) { setRxItems([]); return }
        ; (async () => {
            try {
                const { data } = await listPrescriptions({ patient_id: patientId, status: 'in_progress', limit: 200 })
                const flattened = (data || []).flatMap(rx =>
                    (rx.items || []).map(it => ({
                        rx_id: rx.id,
                        id: it.id, // prescription_item_id
                        medicine_id: it.medicine_id,
                        name: it.medicine?.name || it.medicine_name,
                        code: it.medicine?.code || it.medicine_code,
                        remaining: Math.max(0, (it.quantity || 0) - (it.dispensed_qty || 0)),
                    }))
                ).filter(it => it.remaining > 0)
                if (alive) setRxItems(flattened)
            } catch {
                if (alive) setRxItems([])
            }
        })()
        return () => { alive = false }
    }, [patientId])

    const addRow = () => setItems(s => [...s, { medicine_id: '', qty: 1, lot_id: null }])
    const setRow = (idx, patch) => setItems(s => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
    const delRow = (idx) => setItems(s => s.filter((_, i) => i !== idx))

    // add a line from a prescription item (keeps linkage)
    const addFromRx = (rxItem) => {
        setItems(s => [...s, {
            medicine_id: rxItem.medicine_id,
            qty: rxItem.remaining,
            lot_id: null,
            prescription_item_id: rxItem.id, // <-- IMPORTANT to update Rx on dispense
        }])
    }

    const submit = async () => {
        if (!patientId) { toast.error('Select patient'); return }
        if (!locationId) { toast.error('Select location'); return }

        const clean = items
            .map(it => ({ ...it, medicine_id: Number(it.medicine_id), qty: Number(it.qty || 1) }))
            .filter(it => it.medicine_id && it.qty > 0)

        if (clean.length === 0) { toast.error('Add at least one medicine'); return }

        const payload = {
            context: context || {},
            patient_id: Number(patientId),
            location_id: Number(locationId),
            items: clean.map(it => ({
                medicine_id: it.medicine_id,
                qty: it.qty,
                lot_id: it.lot_id ? Number(it.lot_id) : undefined,
                prescription_item_id: it.prescription_item_id || undefined, // <-- send to backend
            })),
            payment: { mode: 'on-account' },
        }

        setSubmitting(true)
        try {
            const { data } = await dispense(payload)
            toast.success('Dispensed', { description: `Sale #${String(data.id).padStart(6, '0')} created successfully.` })
            setItems([])
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to dispense'
            toast.error('Error', { description: msg })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Dispense</h1>
            </div>

            <PermGate anyOf={['pharmacy.dispense.manage', 'pharmacy.dispense.create']}>
                <Card>
                    <CardContent className="p-4 space-y-4">
                        <PatientPicker value={patientId} onChange={setPatientId} />

                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>Context (auto)</Label>
                                <Input
                                    disabled
                                    value={
                                        context
                                            ? (context.type === 'ipd'
                                                ? `IPD · Admission ${context.admission_id}`
                                                : `OPD · Visit ${context.visit_id}`)
                                            : 'None (will rely on prescription or manual context)'
                                    }
                                />
                            </div>
                            <div>
                                <Label>Location</Label>
                                <Select value={locationId} onValueChange={setLocationId}>
                                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                                    <SelectContent>
                                        {locations.map(l => (
                                            <SelectItem key={l.id} value={String(l.id)}>
                                                {l.code} — {l.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Optional: quick-add from Rx items */}
                        {rxItems.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-sm">Pending prescription items</Label>
                                <div className="grid md:grid-cols-2 gap-2">
                                    {rxItems.map(rxi => (
                                        <Button
                                            key={rxi.id}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addFromRx(rxi)}
                                            title={`Add ${rxi.code} — ${rxi.name} (${rxi.remaining})`}
                                        >
                                            + {rxi.code} — {rxi.name} · Rem: {rxi.remaining}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                            <Label className="text-base">Items</Label>
                            <Button size="sm" variant="outline" onClick={addRow}>
                                <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {items.map((it, idx) => (
                                <div key={idx} className="grid gap-2 md:grid-cols-6 items-end">
                                    <div className="md:col-span-4">
                                        <Label>Medicine</Label>
                                        <Select
                                            value={String(it.medicine_id || '')}
                                            onValueChange={val => setRow(idx, { medicine_id: Number(val) })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                                            <SelectContent>
                                                {meds.map(m => (
                                                    <SelectItem key={m.id} value={String(m.id)}>
                                                        {m.code} — {m.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Qty</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={it.qty}
                                            onChange={e => setRow(idx, { qty: Number(e.target.value || 1) })}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => delRow(idx)}>
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <div className="text-xs text-gray-500">No items added.</div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={submit} disabled={submitting}>
                                {submitting ? 'Dispensing…' : 'Dispense'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </PermGate>
        </div>
    )
}
