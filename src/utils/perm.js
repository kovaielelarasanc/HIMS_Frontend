// frontend/src/utils/perm.js
import { useMemo } from 'react'
import { useAuth } from '../store/authStore'

/**
 * useModulePerms('departments') => { hasAny, canView, canCreate, canUpdate, canDelete }
 * - hasAny: any permission exists for the module (or bootstrap admin)
 * - canX: operation-level permission for the module (or bootstrap admin)
 */
export function useModulePerms(module) {
    const modules = useAuth(s => s.modules) || {}
    const user = useAuth(s => s.user)

    // Bootstrap: if Admin has not configured roles/permissions yet, allow setup modules
    const bootstrapAdmin = user?.is_admin && Object.keys(modules).length === 0

    const list = modules[module] || []
    const ops = useMemo(() => new Set(list.map(p => p.code.split('.').pop())), [list])

    const hasAny = bootstrapAdmin || list.length > 0
    const can = (op) => bootstrapAdmin || ops.has(op)

    return {
        hasAny,
        canView: can('view'),
        canCreate: can('create'),
        canUpdate: can('update'),
        canDelete: can('delete'),
    }
}
