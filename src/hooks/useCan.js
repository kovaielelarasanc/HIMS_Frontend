// frontend/src/hooks/useCan.js
import { useMemo } from 'react'
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
  const permSet = usePermSet()

  if (!code) return false
  if (!user) return false

  // wildcard
  if (permSet.has('*')) return true

  return permSet.has(code)
}

function collectPermObjects(node, out) {
  if (!node) return

  // Array -> walk each item
  if (Array.isArray(node)) {
    for (const x of node) collectPermObjects(x, out)
    return
  }

  // Object -> if it's a permission object, record it; then walk its values
  if (typeof node === 'object') {
    if (typeof node.code === 'string') out.push(node)

    // walk nested keys
    for (const v of Object.values(node)) collectPermObjects(v, out)
  }
}


function buildPermSet({ user, modules }) {
  const set = new Set()

  if (!user) return set
  if (user.is_admin) {
    set.add('*') // super admin wildcard
    return set
  }

  // Admin role shortcut (if you use roles)
  const roles = user.roles || []
  if (roles.some((r) => r?.name === 'Admin' || r?.code === 'admin')) {
    set.add('*')
    return set
  }

  const out = []

  // 1) modules from store (any shape)
  collectPermObjects(modules, out)

  // 2) direct user permissions (if your backend sends it)
  collectPermObjects(user.permissions, out)
  collectPermObjects(user.perms, out)

  // 3) permissions inside roles (common pattern)
  collectPermObjects(roles, out)

  for (const p of out) {
    if (p?.code) set.add(p.code)
  }

  return set
}

function usePermSet() {
  const user = useAuth((s) => s.user)
  const modules = useAuth((s) => s.modules)

  return useMemo(() => buildPermSet({ user, modules }), [user, modules])
}

/** Mirror backend `_need_any` behavior */
export function useCanAny(codes = []) {
  const user = useAuth((s) => s.user)
  const permSet = usePermSet()

  if (!codes?.length) return false
  if (!user) return false

  if (permSet.has('*')) return true

  return codes.some((c) => permSet.has(c))
}
