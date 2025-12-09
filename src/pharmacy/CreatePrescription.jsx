// FILE: src/pharmacy/CreatePrescription.jsx
import { useEffect, useState } from 'react'
import { listMedicines, createPrescription, getPharmacyActiveContext } from '@/api/pharmacy'
import PatientPicker from '@/opd/components/patientpicker'
import PermGate from '@/components/PermGate'
import { Toaster, toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2 } from 'lucide-react'

const newRow = () => ({
    medicine_id: '',
    dose: '',
    am: true,   // default morning dose ON
    af: false,
    pm: true,   // default evening dose ON
    night: false,
    duration_days: 3,
    route: 'po',
    instructions: '',
})

export default function CreatePrescription() {
    const [patientId, setPatientId] = useState(null)
    const [context, setContext] = useState(null) // server auto if null; we just display detected
    const [meds, setMeds] = useState([])
    const [rows, setRows] = useState([newRow()])
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        let ok = true
            ; (async () => {
                try {
                    const data = await listMedicines({ limit: 500, is_active: true }).then(r => r.data || [])
                    if (!ok) return
                    setMeds(data)
                } catch (e) {
                    toast.error('Failed to load medicines', { description: e?.response?.data?.detail || 'Retry' })
                }
            })()
        return () => { ok = false }
    }, [])

    // show context (optional; backend can auto-resolve even if we don’t send)
    useEffect(() => {
        let ok = true
        if (!patientId) return setContext(null)
            ; (async () => {
                try {
                    const { data } = await getPharmacyActiveContext(patientId).catch(() => ({ data: null }))
                    if (!ok) return
                    setContext(data || null)
                } catch {
                    setContext(null)
                }
            })()
        return () => { ok = false }
    }, [patientId])

    const setRow = (idx, patch) =>
        setRows(s => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
    const addRow = () => setRows(s => [...s, newRow()])
    const delRow = (idx) => setRows(s => s.filter((_, i) => i !== idx))

    const computeQty = (r) => {
        const tod = (r.am ? 1 : 0) + (r.af ? 1 : 0) + (r.pm ? 1 : 0) + (r.night ? 1 : 0)
        const days = Math.max(1, Number(r.duration_days || 0))
        return tod * days
    }

    const validate = () => {
        if (!patientId) {
            toast.error('Select patient')
            return false
        }
        if (rows.length === 0) {
            toast.error('Add at least one medicine')
            return false
        }
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i]
            if (!r.medicine_id) {
                toast.error(`Select medicine for row ${i + 1}`)
                return false
            }
            const tod = (r.am ? 1 : 0) + (r.af ? 1 : 0) + (r.pm ? 1 : 0) + (r.night ? 1 : 0)
            if (tod === 0) {
                toast.error(`Choose at least one time-of-day for row ${i + 1}`)
                return false
            }
            const days = Number(r.duration_days)
            if (!days || days < 1) {
                toast.error(`Days must be ≥ 1 for row ${i + 1}`)
                return false
            }
            const qty = computeQty(r)
            if (!qty || qty <= 0) {
                toast.error(`Quantity computes to 0 for row ${i + 1}`)
                return false
            }
        }
        return true
    }

    const save = async () => {
        if (!validate()) return
        const payload = {
            patient_id: Number(patientId),
            notes,
            items: rows.map(r => ({
                medicine_id: Number(r.medicine_id),
                dose: r.dose || '',
                am: !!r.am,
                af: !!r.af,
                pm: !!r.pm,
                night: !!r.night,
                duration_days: Number(r.duration_days) || 1,
                quantity: computeQty(r),
                route: r.route || 'po',
                instructions: r.instructions || '',
            })),
        }
        setSaving(true)
        try {
            await createPrescription(payload)
            toast.success('Prescription created')
            // reset to a fresh form; keep patient for convenience
            setRows([newRow()])
            setNotes('')
        } catch (e) {
            toast.error('Failed to create prescription', { description: e?.response?.data?.detail || 'Retry' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="p-4 space-y-4">
            <Toaster richColors closeButton position="top-right" />
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Create Prescription</h1>
            </div>

            <PermGate anyOf={['ipd.doctor', 'prescriptions.create']}>
                <Card>
                    <CardContent className="p-4 space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="md:col-span-2">
                                <Label>Patient</Label>
                                <PatientPicker value={patientId} onChange={setPatientId} />
                            </div>
                            <div>
                                <Label>Context (auto)</Label>
                                <Input
                                    disabled
                                    value={
                                        context
                                            ? (context.type === 'ipd'
                                                ? `IPD · Admission ${context.admission_id}`
                                                : `OPD · Visit ${context.visit_id}`)
                                            : 'Will auto-detect (OPD/IPD)'
                                    }
                                />
                            </div>
                        </div>

                        {/* Rows */}
                        <div className="flex items-center justify-between mt-2">
                            <Label className="text-base">Medicines</Label>
                            <Button size="sm" variant="outline" onClick={addRow}>
                                <Plus className="h-4 w-4 mr-1" /> Add more medicines
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {rows.map((r, idx) => {
                                const computedQty = computeQty(r)
                                return (
                                    <div key={idx} className="grid gap-3 md:grid-cols-12 items-end rounded-xl border p-3">
                                        {/* Medicine */}
                                        <div className="md:col-span-4">
                                            <Label>Medicine</Label>
                                            <Select
                                                value={String(r.medicine_id || '')}
                                                onValueChange={(v) => setRow(idx, { medicine_id: Number(v) })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select medicine…" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {meds.map(m => (
                                                        <SelectItem key={m.id} value={String(m.id)}>
                                                            {m.code} — {m.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Dose */}
                                        <div className="md:col-span-2">
                                            <Label>Dosage (e.g., 500 mg)</Label>
                                            <Input value={r.dose} onChange={e => setRow(idx, { dose: e.target.value })} />
                                        </div>

                                        {/* ToD */}
                                        <div className="md:col-span-3">
                                            <Label>Time of day</Label>
                                            <div className="flex flex-wrap gap-3 text-sm py-1">
                                                <label className="flex items-center gap-2">
                                                    <Checkbox checked={r.am} onCheckedChange={(v) => setRow(idx, { am: !!v })} /> AM
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <Checkbox checked={r.af} onCheckedChange={(v) => setRow(idx, { af: !!v })} /> AF
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <Checkbox checked={r.pm} onCheckedChange={(v) => setRow(idx, { pm: !!v })} /> PM
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <Checkbox checked={r.night} onCheckedChange={(v) => setRow(idx, { night: !!v })} /> Night
                                                </label>
                                            </div>
                                        </div>

                                        {/* Days */}
                                        <div className="md:col-span-1">
                                            <Label>Days</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={r.duration_days}
                                                onChange={e => setRow(idx, { duration_days: Number(e.target.value || 1) })}
                                            />
                                        </div>

                                        {/* Quantity (auto) */}
                                        <div className="md:col-span-1">
                                            <Label>Quantity (auto)</Label>
                                            <Input value={computedQty} readOnly />
                                        </div>

                                        {/* Remove */}
                                        <div className="md:col-span-1 flex justify-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => delRow(idx)}
                                                className="text-rose-600 hover:text-rose-700"
                                                title="Remove row"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* Optional instructions (full width below) */}
                                        <div className="md:col-span-12">
                                            <Label>Instructions (optional)</Label>
                                            <Input
                                                placeholder="e.g., After food; drink water; avoid spicy food"
                                                value={r.instructions}
                                                onChange={e => setRow(idx, { instructions: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )
                            })}

                            {rows.length === 0 && <div className="text-xs text-gray-500">No medicines added.</div>}
                        </div>

                        {/* Notes + Save */}
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="md:col-span-2">
                                <Label>Notes</Label>
                                <Input
                                    placeholder="Optional note for prescription"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                            <div className="flex items-end justify-end">
                                <Button onClick={save} disabled={saving}>
                                    {saving ? 'Saving…' : 'Save Prescription'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </PermGate>
        </div>
    )
}
