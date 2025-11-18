// src/shared/useDebounce.js
import { useEffect, useState } from 'react'
export function useDebounce(value, delay = 250) {
    const [v, setV] = useState(value)
    useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t) }, [value, delay])
    return v
}
