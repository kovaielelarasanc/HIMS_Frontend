export default function StatusBadge({ status }) {
    const s = String(status || 'ordered').toLowerCase()
    const map = {
        ordered: 'bg-amber-50 text-amber-700 border-amber-200',
        collected: 'bg-blue-50 text-blue-700 border-blue-200',
        validated: 'bg-purple-50 text-purple-700 border-purple-200',
        reported: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
    }
    const cls = map[s] || 'bg-gray-50 text-gray-700 border-gray-200'
    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
    )
}
