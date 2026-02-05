// FILE: frontend/src/hooks/usePerm.js
import { useAuth } from '../store/authStore'

function buildPermSet(modules) {
    const set = new Set()
    const stack = [modules]

    while (stack.length) {
        const cur = stack.pop()
        if (!cur) continue

        // Array: could be [{code,label}, ...] OR nested arrays/objects
        if (Array.isArray(cur)) {
            for (const item of cur) {
                if (!item) continue
                if (typeof item === 'object' && typeof item.code === 'string') {
                    set.add(item.code)
                }
                // traverse deeper just in case
                if (typeof item === 'object') stack.push(item)
            }
            continue
        }

        // Object: could be modules map OR a permission object OR nested
        if (typeof cur === 'object') {
            if (typeof cur.code === 'string') set.add(cur.code)
            for (const v of Object.values(cur)) stack.push(v)
        }
    }

    return set
}

/**
 * useCan('ipd.nursing.create')
 * - If not logged in  -> false
 * - If user.is_admin  -> true
 * - Else              -> flattened permission lookup
 */
export function useCan(code) {
    const user = useAuth((s) => s.user)
    const modules = useAuth((s) => s.modules) || {}

    if (!code) return false
    if (!user) return false
    if (user.is_admin) return true

    // robust: handles any modules shape
    const permSet = buildPermSet(modules)
    return permSet.has(code)
}
