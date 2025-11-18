export const money = (n) => (Number.isFinite(+n) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(+n) : '₹0.00')

export const fmtDT = (s) => {
    if (!s) return '—'
    const d = typeof s === 'string' ? new Date(s) : s
    if (Number.isNaN(d?.getTime?.())) return '—'
    return d.toLocaleString()
}

export const pid = (id) => (id ? `PID-${String(id).padStart(5, '0')}` : '—')
