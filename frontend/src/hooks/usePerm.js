// frontend/src/hooks/usePerm.js
import { useAuth } from '../store/authStore'
export function useCan(code) {
    const modules = useAuth(s => s.modules) || {}
    const all = Object.values(modules).flat() // [{code,label},...]
    return !!all.find(p => p.code === code)
}
