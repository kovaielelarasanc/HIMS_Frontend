import { useCanFn } from "../hooks/useCan"

export default function PermGate({ anyOf = [], allOf = [], children, fallback = null }) {
    const { can, canAny } = useCanFn()
    const canList = (codes) => (codes || []).every((c) => can(c))
    const pass =
        (anyOf.length > 0 && canAny(anyOf)) ||
        (allOf.length > 0 && canList(allOf)) ||
        (anyOf.length === 0 && allOf.length === 0)

    if (!pass) return fallback
    return children
}
