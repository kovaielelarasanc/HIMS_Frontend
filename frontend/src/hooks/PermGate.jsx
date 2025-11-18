import { useCan } from '../hooks/usePerm'

export default function PermGate({ anyOf = [], allOf = [], children, fallback = null }) {
    const canList = (codes) => codes.every((c) => useCan(c))
    const pass =
        (anyOf.length > 0 && anyOf.some((c) => useCan(c))) ||
        (allOf.length > 0 && canList(allOf)) ||
        (anyOf.length === 0 && allOf.length === 0)

    if (!pass) return fallback
    return children
}
