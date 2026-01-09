// FILE: src/hooks/useCan.js
import { useMemo } from "react"

/**
 * Simple stub.
 * Replace `permissions` with your auth store/context (JWT claims, /me endpoint, etc).
 *
 * Usage:
 *   const can = useCan()
 *   if (can("billing.invoices.post")) ...
 */
export function useCan() {
    // TODO: wire from your real auth state
    const permissions = useMemo(() => {
        try {
            // Example if you store perms in localStorage:
            // localStorage.setItem("perms", JSON.stringify(["billing.cases.view", ...]))
            const raw = localStorage.getItem("perms")
            const arr = raw ? JSON.parse(raw) : null
            return Array.isArray(arr) ? arr : ["*"] // default allow-all for now
        } catch {
            return ["*"]
        }
    }, [])

    return (code) => {
        if (!code) return true
        if (permissions.includes("*")) return true
        return permissions.includes(code)
    }
}
