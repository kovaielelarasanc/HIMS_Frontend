// import { useAuth } from '../store/authStore'

// export function useCan(code) {
//     const modules = useAuth(s => s.modules) || {}
//     const [module, action] = code.split('.')
//     const list = modules[module] || []
//     return list.some(p => p.code === code)
// }


// frontend/src/hooks/useCan.js
import { useAuth } from '../store/authStore'

export function useCan(code) {
  const user = useAuth((s) => s.user)
  const modules = useAuth((s) => s.modules) || {}

  if (!code) return false
  if (!user) return false

  // ✅ Super admin shortcut
  if (user.is_admin) {
    return true
  }

  // ✅ Fallback: if roles array has Admin
  const roles = user.roles || []
  if (roles.some((r) => r.name === 'Admin' || r.code === 'admin')) {
    return true
  }

  // ✅ Normal RBAC: modules = { patients: [{code: 'patients.masters.view'}, ...] }
  const [module] = code.split('.')
  const list = modules[module] || []
  return list.some((p) => p.code === code)
}
