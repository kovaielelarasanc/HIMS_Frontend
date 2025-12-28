// FILE: frontend/src/ipd/nursing/ui/utils.js

export const cx = (...a) => a.filter(Boolean).join(' ')

/**
 * Format datetime in IST (Asia/Kolkata) for display.
 * Accepts ISO strings / Date / timestamps.
 */
export const fmtIST = (dt) => {
  if (!dt) return '—'
  try {
    const d = dt instanceof Date ? dt : new Date(dt)
    if (Number.isNaN(d.getTime())) return String(dt)

    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(dt)
  }
}

export const statusTone = (status) => {
  const s = (status || '').toLowerCase()
  if (['completed', 'verified', 'done'].includes(s)) return 'success'
  if (['pending', 'ordered', 'issued', 'active', 'in_progress'].includes(s)) return 'warning'
  if (['reaction', 'stopped', 'cancelled', 'canceled'].includes(s)) return 'danger'
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

/**
 * Convert datetime-local value to ISO string with seconds
 * - "YYYY-MM-DDTHH:mm" => "YYYY-MM-DDTHH:mm:00"
 * - leaves other values unchanged
 */
export const toIso = (v) => {
  if (!v) return null
  const s = String(v)
  return s.length === 16 ? `${s}:00` : s
}

export const safeStr = (v) => (v === null || v === undefined ? '' : String(v))

/**
 * Convert ISO (or Date) to datetime-local input value "YYYY-MM-DDTHH:mm"
 * Works with Z / +05:30 / naive too.
 */
export const toLocalInput = (dt) => {
  if (!dt) return ''
  try {
    const d = dt instanceof Date ? dt : new Date(dt)
    if (Number.isNaN(d.getTime())) return String(dt).slice(0, 16)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

/** robust int */
export const toIntOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** robust yes/no */
export const boolOrFalse = (v) => !!v

/** display user label from object/string/id */
export const userLabel = (u, fallbackId) => {
  if (!u) return fallbackId ?? '—'
  if (typeof u === 'string') return u
  return u.name || u.full_name || u.display_name || u.email || fallbackId || '—'
}
