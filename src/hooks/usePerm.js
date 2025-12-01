// // frontend/src/hooks/usePerm.js
// import { useAuth } from '../store/authStore'
// export function useCan(code) {
//     const modules = useAuth(s => s.modules) || {}
//     const all = Object.values(modules).flat() // [{code,label},...]
//     return !!all.find(p => p.code === code)
// }
// // 




// frontend/src/hooks/usePerm.js
import { useAuth } from '../store/authStore'

/**
 * useCan('patients.masters.view')
 *
 * - If not logged in  -> false
 * - If user.is_admin  -> true (all permissions)
 * - Else              -> checks in modules map from /auth/me/permissions
 *
 * Expected modules shape (already in your store):
 * {
 *   "patients": [
 *     { code: "patients.view", label: "..." },
 *     { code: "patients.masters.view", label: "..." },
 *     ...
 *   ],
 *   "billing": [ ... ],
 *   ...
 * }
 */
// frontend/src/hooks/useCan.js


export function useCan(code) {
  const user = useAuth((s) => s.user)
  const modules = useAuth((s) => s.modules) || {}

  if (!code) return false
  if (!user) return false

  // ✅ Admin = full access to everything
  if (user.is_admin) {
    return true
  }

  // For codes like "patients.masters.view"
  const [module] = code.split('.')   // "patients"
  const list = modules[module] || [] // [{ code: "patients.masters.view", label: "..." }, ...]

  return list.some((p) => p.code === code)
}
