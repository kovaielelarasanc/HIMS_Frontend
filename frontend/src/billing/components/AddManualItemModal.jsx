import { X } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function AddManualItemModal({ open, onClose, onSubmit, disabled }) {
    const [form, setForm] = useState({
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
        service_type: 'manual',
        service_ref_id: 0,
    })

    useEffect(() => {
        if (!open) return
        // optional reset when reopened
        setForm(f => ({ ...f, description: '', quantity: 1, unit_price: 0, tax_rate: 0 }))
    }, [open])

    if (!open) return null

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

    const submit = (e) => {
        e?.preventDefault?.()
        if (!form.description) return
        onSubmit({
            description: form.description,
            quantity: Number(form.quantity || 1),
            unit_price: Number(form.unit_price || 0),
            tax_rate: Number(form.tax_rate || 0),
            service_type: form.service_type || 'manual',
            service_ref_id: Number(form.service_ref_id || 0),
        })
    }

    return (
        <div className="fixed inset-0 z-50">
            {/* overlay */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            {/* panel */}
            <div
                role="dialog"
                aria-modal="true"
                className="absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xl"
            >
                <header className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold">Add manual item</h3>
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <form onSubmit={submit} className="p-4 space-y-3">
                    <div>
                        <label className="text-sm font-medium">Description</label>
                        <input
                            className="input w-full"
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            placeholder="e.g., Dressing charges"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium">Quantity</label>
                            <input
                                className="input w-full"
                                type="number"
                                min="1"
                                value={form.quantity}
                                onChange={e => set('quantity', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Unit Price</label>
                            <input
                                className="input w-full"
                                type="number"
                                step="0.01"
                                value={form.unit_price}
                                onChange={e => set('unit_price', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium">Tax %</label>
                            <input
                                className="input w-full"
                                type="number"
                                step="0.01"
                                value={form.tax_rate}
                                onChange={e => set('tax_rate', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Type (optional)</label>
                            <input
                                className="input w-full"
                                value={form.service_type}
                                onChange={e => set('service_type', e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Reference ID (optional)</label>
                        <input
                            className="input w-full"
                            type="number"
                            value={form.service_ref_id}
                            onChange={e => set('service_ref_id', e.target.value)}
                        />
                    </div>

                    <div className="pt-2">
                        <button type="submit" className="btn w-full" disabled={disabled}>
                            Add Item
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
