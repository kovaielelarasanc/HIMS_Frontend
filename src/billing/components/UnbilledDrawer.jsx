import { X } from 'lucide-react'
import { money } from '../../utils/format'

export default function UnbilledDrawer({ open, onClose, rows = [], pick = {}, setPick, onApply, disabled }) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50">
            {/* overlay */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            {/* drawer */}
            <aside
                role="dialog"
                aria-modal="true"
                className="absolute right-0 top-0 h-full w-[min(92vw,480px)] bg-white shadow-xl transition-transform duration-300 translate-x-0"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold">Add from Unbilled</h3>
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="p-3 overflow-y-auto h-[calc(100%-110px)]">
                    <div className="space-y-2">
                        {rows.map(r => (
                            <label key={r.uid} className="flex items-start gap-3 rounded-xl border p-3">
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={!!pick[r.uid]}
                                    onChange={(e) => setPick(prev => ({ ...prev, [r.uid]: e.target.checked }))}
                                />
                                <div className="min-w-0">
                                    <div className="text-sm font-medium">{r.description}</div>
                                    <div className="text-xs text-gray-500">
                                        {r.category} · {money(r.unit_price)} · {r.href}
                                    </div>
                                </div>
                            </label>
                        ))}
                        {rows.length === 0 && (
                            <div className="text-sm text-gray-500 p-3">No unbilled items found.</div>
                        )}
                    </div>
                </div>

                <footer className="p-3 border-t">
                    <button className="btn w-full" onClick={onApply} disabled={disabled}>
                        Add selected
                    </button>
                </footer>
            </aside>
        </div>
    )
}
