import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

const MODES = ['cash', 'card', 'upi', 'bank_transfer']

export default function PaymentModal({ open, onClose, onSubmit, disabled, maxAmount = 0 }) {
    const [form, setForm] = useState({ amount: 0, mode: 'cash', reference_no: '' })

    // keep default amount in sync when dialog opens or max changes
    useEffect(() => {
        if (open) setForm(prev => ({ ...prev, amount: maxAmount || 0 }))
    }, [open, maxAmount])

    if (!open) return null

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

    const submit = (e) => {
        e?.preventDefault?.()
        if (!form.amount || Number(form.amount) <= 0) return
        onSubmit({
            amount: Number(form.amount),
            mode: form.mode,
            reference_no: form.reference_no || null,
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
                className="absolute left-1/2 top-1/2 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xl"
            >
                <header className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold">Record payment</h3>
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <form onSubmit={submit} className="p-4 space-y-3">
                    <div>
                        <label className="text-sm font-medium">Amount</label>
                        <input
                            className="input w-full"
                            type="number"
                            step="0.01"
                            value={form.amount}
                            onChange={e => set('amount', e.target.value)}
                        />
                        {maxAmount > 0 && (
                            <div className="text-xs text-gray-500 mt-1">Max suggested: {maxAmount}</div>
                        )}
                    </div>
                    <div>
                        <label className="text-sm font-medium">Mode</label>
                        <select
                            className="input w-full"
                            value={form.mode}
                            onChange={e => set('mode', e.target.value)}
                        >
                            {MODES.map(m => (
                                <option key={m} value={m}>{m.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Reference (optional)</label>
                        <input
                            className="input w-full"
                            value={form.reference_no}
                            onChange={e => set('reference_no', e.target.value)}
                            placeholder="Txn ID / cheque no. etc."
                        />
                    </div>

                    <div className="pt-2">
                        <button type="submit" className="btn w-full" disabled={disabled}>
                            Save Payment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
