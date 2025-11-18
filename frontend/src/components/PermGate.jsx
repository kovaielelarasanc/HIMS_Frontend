import { useAuth } from '../store/authStore'

export default function PermGate({ anyOf = [], fallback = null, children }) {
    const user = useAuth(s => s.user)
    const modules = useAuth(s => s.modules) || {}
    const admin = !!user?.is_admin
    if (admin) return children

    const granted = new Set(
        Object.values(modules).flat().map(p => (typeof p === 'string' ? p : p?.code)).filter(Boolean)
    )
    const ok = anyOf.length === 0 || anyOf.some(c => granted.has(c))
    return ok ? children : fallback
}
