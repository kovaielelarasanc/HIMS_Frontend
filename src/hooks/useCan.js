import { useAuth } from '../store/authStore'

export function useCan(code) {
    const modules = useAuth(s => s.modules) || {}
    if (!code) return false
    const [module, action] = code.split('.')
    const list = modules[module] || []
    return list.some(p => p.code === code)
}
