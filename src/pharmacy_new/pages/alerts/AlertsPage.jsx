// FILE: src/pharmacy/pages/alerts/AlertsPage.jsx
import React, { useEffect, useState } from "react"
import { toast } from "sonner"
import { Bell } from "lucide-react"
import { phListAlerts } from "../../../api/pharmacy_new"
import { usePharmacyStore } from "../../hooks/usePharmacyStore"

export default function AlertsPage() {
    const { storeId } = usePharmacyStore()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const data = await phListAlerts({ store_id: storeId || undefined, limit: 200, offset: 0 })
            setRows(data?.items || data || [])
        } catch (e) {
            toast.error(e.message || "Failed to load alerts")
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [storeId])

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">Alerts</h2>
                    <p className="text-[12px] text-slate-500">Low stock • Expiry • Recall • Quarantine</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                    <Bell className="h-5 w-5" />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                    <p className="text-[12px] text-slate-500">{loading ? "Loading…" : `${rows.length} alerts`}</p>
                </div>
                <div className="divide-y divide-slate-100">
                    {rows.map((a, i) => (
                        <div key={a.id || i} className="p-4">
                            <p className="text-sm font-semibold text-slate-900">{a.title || a.type || "Alert"}</p>
                            <p className="text-[12px] text-slate-500">{a.message || "—"}</p>
                        </div>
                    ))}
                    {!rows.length && !loading ? (
                        <div className="p-8 text-center text-slate-500">No alerts.</div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
