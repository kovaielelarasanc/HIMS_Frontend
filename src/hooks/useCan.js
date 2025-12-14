// frontend/src/hooks/useCan.js
import { useAuth } from '../store/authStore'

function flattenPerms(modules) {
  if (!modules) return []
  // modules can be: { ot: [{code}], patients: [{code}] } OR anything else
  if (Array.isArray(modules)) return modules
  if (typeof modules === 'object') {
    return Object.values(modules).flat().filter(Boolean)
  }
  return []
}

export function useCan(code) {
  const user = useAuth((s) => s.user)
  const modules = useAuth((s) => s.modules)

  if (!code) return false
  if (!user) return false

  // ✅ Super admin shortcut
  if (user.is_admin) return true

  // ✅ Admin role shortcut (if you use roles)
  const roles = user.roles || []
  if (roles.some((r) => r?.name === 'Admin' || r?.code === 'admin')) return true

  // ✅ Fast path: try by first segment (your current behavior)
  const [seg] = code.split('.')
  const list = (modules && typeof modules === 'object' && Array.isArray(modules[seg]))
    ? modules[seg]
    : null
  if (list?.some((p) => p?.code === code)) return true

  // ✅ Robust fallback: scan everything (fixes grouping mismatch)
  const all = flattenPerms(modules)
  return all.some((p) => p?.code === code)
}

/** Mirror backend _need_any helper */
export function useCanAny(codes = []) {
  const user = useAuth((s) => s.user)
  const modules = useAuth((s) => s.modules)

  if (!codes?.length) return false
  if (!user) return false

  if (user.is_admin) return true
  const roles = user.roles || []
  if (roles.some((r) => r?.name === 'Admin' || r?.code === 'admin')) return true

  const all = flattenPerms(modules)
  return codes.some((code) => all.some((p) => p?.code === code))
}
