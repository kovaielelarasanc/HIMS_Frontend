// FILE: frontend/src/ipd/nursing/ui/utils.js
export const cx = (...a) => a.filter(Boolean).join(' ')

export const fmtIST = (iso) => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return String(iso)
  }
}

export const statusTone = (status) => {
  const s = (status || '').toLowerCase()
  if (['completed', 'verified', 'done'].includes(s)) return 'success'
  if (['pending', 'ordered', 'issued', 'active', 'in_progress'].includes(s)) return 'warning'
  if (['reaction', 'stopped', 'cancelled'].includes(s)) return 'danger'
  return 'neutral'
}

export const toneClass = (tone) => {
  switch (tone) {
    case 'success':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
    case 'warning':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
    case 'danger':
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
    default:
      return 'bg-zinc-50 text-zinc-700 ring-1 ring-zinc-100'
  }
}

export const toIso = (v) => (!v ? null : v.length === 16 ? `${v}:00` : v)

export const safeStr = (v) => (v === null || v === undefined ? '' : String(v))
