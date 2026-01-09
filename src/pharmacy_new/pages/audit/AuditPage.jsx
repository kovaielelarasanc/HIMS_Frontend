// FILE: src/pharmacy/pages/audit/AuditPage.jsx
import React, { useEffect, useState } from "react"
import { toast } from "sonner"
import { ScrollText } from "lucide-react"
import { phListAudit } from "../../../api/pharmacy_new"
import { fmtDT } from "../../ui/utils"

export default function AuditPage() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let alive = true
            ; (async () => {
                setLoading(true)
                try {
                    const data = await phListAudit({ limit: 200, offset: 0 })
                    if (!alive) return
                    setRows(data || data?.items || [])
                } catch (e) {
                    toast.error(e.message || "Failed to load audit")
                    setRows([])
                } finally {
                    if (alive) setLoading(false)
                }
            })()
        return () => { alive = false }
    }, [])

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-start justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">Audit</h2>
                    <p className="text-[12px] text-slate-500">Every POST action should write one audit event.</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                    <ScrollText className="h-5 w-5" />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                    <p className="text-[12px] text-slate-500">{loading ? "Loading…" : `${rows.length} events`}</p>
                </div>

                <div className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                        <div key={r.id || i} className="p-4">
                            <p className="text-sm font-semibold text-slate-900">{r.action || "EVENT"} • {r.entity_type || "Entity"} #{r.entity_id || "—"}</p>
                            <p className="text-[12px] text-slate-500">At: {fmtDT(r.created_at || r.at)} • By: {r.actor_user_id || "—"}</p>
                        </div>
                    ))}
                    {!rows.length && !loading ? (
                        <div className="p-8 text-center text-slate-500">No audit events yet.</div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
