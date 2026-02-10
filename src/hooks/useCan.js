// frontend/src/hooks/useCan.js
import { useCallback, useMemo } from "react"
import { useAuth } from "../store/authStore"

function collectPermObjects(node, out) {
  if (!node) return

  if (Array.isArray(node)) {
    for (const x of node) collectPermObjects(x, out)
    return
  }

  if (typeof node === "object") {
    if (typeof node.code === "string") out.push(node)
    for (const v of Object.values(node)) collectPermObjects(v, out)
  }
}

function buildPermSet({ user, modules }) {
  const set = new Set()

  if (!user) return set
  if (user.is_admin) {
    set.add("*")
    return set
  }

  const roles = user.roles || []
  if (
    roles.some(
      (r) =>
        (typeof r === "string" && r.toLowerCase() === "admin") ||
        r?.name === "Admin" ||
        r?.code === "admin"
    )
  ) {
    set.add("*")
    return set
  }

  const out = []
  collectPermObjects(modules, out)
  collectPermObjects(user.permissions, out)
  collectPermObjects(user.perms, out)
  collectPermObjects(roles, out)

  for (const p of out) if (p?.code) set.add(p.code)

  return set
}

export function usePermSet() {
  const user = useAuth((s) => s.user)
  const modules = useAuth((s) => s.modules)
  return useMemo(() => buildPermSet({ user, modules }), [user, modules])
}

/** ✅ Hook: use for single fixed checks (NOT inside map/filter) */
export function useCan(code) {
  const user = useAuth((s) => s.user)
  const permSet = usePermSet()

  if (!code) return false
  if (!user) return false
  if (permSet.has("*")) return true

  return permSet.has(code)
}

/** ✅ Hook: use for fixed array checks (NOT inside map/filter) */
export function useCanAny(codes = []) {
  const user = useAuth((s) => s.user)
  const permSet = usePermSet()

  if (!codes?.length) return false
  if (!user) return false
  if (permSet.has("*")) return true

  return codes.some((c) => permSet.has(c))
}

/**
 * ✅ BEST: returns plain functions `can()` and `canAny()`
 * Safe to use inside loops/maps/filters.
 */
export function useCanFn() {
  const user = useAuth((s) => s.user)
  const permSet = usePermSet()

  const can = useCallback(
    (code) => {
      if (!code) return false
      if (!user) return false
      if (permSet.has("*")) return true
      return permSet.has(code)
    },
    [user, permSet]
  )

  const canAny = useCallback(
    (codes = []) => {
      if (!codes?.length) return false
      if (!user) return false
      if (permSet.has("*")) return true
      return codes.some((c) => permSet.has(c))
    },
    [user, permSet]
  )

  return { can, canAny, permSet }
}
