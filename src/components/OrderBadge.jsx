// src/components/OrderBadge.jsx
import { Link } from 'react-router-dom'

export default function OrderBadge({ order, to, className = '', prefix = 'LAB' }) {
    const created = new Date(order?.created_at || order?.createdAt || Date.now())
    const yymm = created.toISOString().slice(2, 7).replace('-', '') // YYMM
    const encoded = Number(order?.id || 0).toString(36).toUpperCase().padStart(3, '0')
    const fallback = `${prefix}-${yymm}-${encoded}`
    const label = order?.accession_no || fallback

    const chip = (
        <span
            className={[
                'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                'bg-blue-50 border-blue-200 text-blue-700',
                className,
            ].join(' ')}
            title={`Created ${created.toLocaleString()}`}
        >
            {label}
        </span>
    )
    return to ? <Link to={to}>{chip}</Link> : chip
}
