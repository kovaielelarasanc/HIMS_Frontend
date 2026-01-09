// FILE: src/pharmacy/pages/PharmacyDashboard.jsx
import React, { useEffect, useMemo, useState } from "react"
import { Boxes, AlertTriangle, TrendingDown, PackageSearch } from "lucide-react"
import { phListAlerts, phStockSummary, phListItems } from "../../api/pharmacy_new"
import { cx } from "../ui/utils"
import { usePharmacyStore } from "../hooks/usePharmacyStore"

const Card = ({ title, value, icon: Icon, hint }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-[12px] text-slate-500">{title}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                {hint ? <p className="mt-1 text-[12px] text-slate-500">{hint}</p> : null}
            </div>
            <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <Icon className="h-5 w-5" />
            </div>
        </div>
    </div>
)

export default function PharmacyDashboard() {
    const { storeId } = usePharmacyStore()
    const [loading, setLoading] = useState(false)
    const [alertsCount, setAlertsCount] = useState(0)
    const [belowReorder, setBelowReorder] = useState(0)
    const [itemsCount, setItemsCount] = useState(0)

    useEffect(() => {
        let alive = true
            ; (async () => {
                setLoading(true)
                try {
                    const [alerts, summary, items] = await Promise.allSettled([
                        phListAlerts({ store_id: storeId || undefined, limit: 100 }),
                        phStockSummary({ store_id: storeId || undefined, below: "reorder", limit: 100 }),
                        phListItems({ limit: 1, offset: 0 }),
                    ])

                    if (!alive) return

                    if (alerts.status === "fulfilled") {
                        const list = alerts.value?.items || alerts.value || []
                        setAlertsCount(Array.isArray(list) ? list.length : 0)
                    }

                    if (summary.status === "fulfilled") {
                        const list = summary.value?.items || []
                        setBelowReorder(Array.isArray(list) ? list.length : 0)
                    }

                    if (items.status === "fulfilled") {
                        // backend returns: {items:[], limit, offset...} in your stub
                        const guess = items.value?.items?.length ?? 0
                        setItemsCount(guess)
                    }
                } finally {
                    if (alive) setLoading(false)
                }
            })()
        return () => { alive = false }
    }, [storeId])

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card title="Active Alerts" value={alertsCount} icon={AlertTriangle} hint="Expiry • Low stock • Recall" />
                <Card title="Below Reorder" value={belowReorder} icon={TrendingDown} hint="Items needing purchase action" />
                <Card title="Items Catalog" value={itemsCount} icon={PackageSearch} hint="Medicines • Consumables • Devices" />
            </div>

            <div className={cx("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm")}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Operational next steps</h2>
                        <p className="text-[12px] text-slate-500 mt-0.5">Use this flow daily for audit-safe pharmacy operations.</p>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Boxes className="h-5 w-5 text-slate-700" />
                    </div>
                </div>

                <ol className="mt-3 space-y-2 text-sm text-slate-700">
                    <li className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                        1) Create/Approve GRN → <span className="font-medium">Post</span> (Stock IN + landed cost + ledger)
                    </li>
                    <li className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                        2) Review Stock → Low stock & Expiry alerts → Raise PO
                    </li>
                    <li className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                        3) Dispense with FEFO → Post (Stock OUT + insurance split if applied)
                    </li>
                </ol>

                {loading ? (
                    <p className="mt-3 text-[12px] text-slate-500">Refreshing summary…</p>
                ) : null}
            </div>
        </div>
    )
}
