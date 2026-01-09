// FILE: src/pharmacy/pages/insurance/InsurancePage.jsx
import React, { useEffect, useState } from "react"
import { toast } from "sonner"
import { ShieldCheck } from "lucide-react"
import { phListPayers, phListPlans } from "../../../api/pharmacy_new"

export default function InsurancePage() {
    const [payers, setPayers] = useState([])
    const [plans, setPlans] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let alive = true
            ; (async () => {
                setLoading(true)
                try {
                    const [p, pl] = await Promise.all([phListPayers(), phListPlans()])
                    if (!alive) return
                    setPayers(Array.isArray(p) ? p : p?.items || [])
                    setPlans(Array.isArray(pl) ? pl : pl?.items || [])
                } catch (e) {
                    toast.error(e.message || "Failed to load insurance masters")
                } finally {
                    if (alive) setLoading(false)
                }
            })()
        return () => { alive = false }
    }, [])

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Insurance</h2>
                        <p className="text-[12px] text-slate-500">Maintain payers, plans, coverage rules, and contract pricing.</p>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Box title="Payers" count={payers.length} loading={loading} />
                    <Box title="Plans" count={plans.length} loading={loading} />
                </div>

                <p className="mt-4 text-[12px] text-slate-500">
                    Next step: I can generate full CRUD UI for Payers/Plans/Contract Prices once you confirm your final DB fields.
                </p>
            </div>
        </div>
    )
}

function Box({ title, count, loading }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[12px] text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : count}</p>
        </div>
    )
}
