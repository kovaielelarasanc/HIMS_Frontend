// src/components/ModalityBadge.jsx
export default function ModalityBadge({ modality }) {
    const m = String(modality || '').toUpperCase()
    const map = {
        XR: 'bg-sky-50 text-sky-700 border-sky-200',
        CT: 'bg-purple-50 text-purple-700 border-purple-200',
        MRI: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        USG: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        MAMMO: 'bg-rose-50 text-rose-700 border-rose-200',
    }
    const cls = map[m] || 'bg-gray-50 text-gray-700 border-gray-200'
    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
            {m || '—'}
        </span>
    )
}
