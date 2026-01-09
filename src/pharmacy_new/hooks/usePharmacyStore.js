// FILE: src/pharmacy/hooks/usePharmacyStore.js
import { useEffect, useMemo, useState } from "react"
import { phListStores } from "../../api/pharmacy_new"

const KEY = "pharmacy.store_id"

export function usePharmacyStore() {
    const [stores, setStores] = useState([])
    const [storeId, setStoreId] = useState(() => {
        const v = localStorage.getItem(KEY)
        return v ? Number(v) : null
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let alive = true
            ; (async () => {
                setLoading(true)
                try {
                    const data = await phListStores()
                    if (!alive) return
                    const list = Array.isArray(data) ? data : (data?.items || [])
                    setStores(list)

                    // Auto pick first store
                    if (!storeId && list?.length) {
                        setStoreId(list[0].id)
                        localStorage.setItem(KEY, String(list[0].id))
                    }
                } finally {
                    if (alive) setLoading(false)
                }
            })()
        return () => { alive = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const current = useMemo(() => stores.find((s) => s.id === storeId) || null, [stores, storeId])

    const set = (id) => {
        const n = id ? Number(id) : null
        setStoreId(n)
        if (n) localStorage.setItem(KEY, String(n))
        else localStorage.removeItem(KEY)
    }

    return { stores, storeId, setStoreId: set, current, loading }
}
