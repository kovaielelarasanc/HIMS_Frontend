// FILE: src/pharmacy/pages/dispense/DispensePage.jsx
import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { phListDispenses } from "../../../api/pharmacy_new"
import { fmtDate, statusTone, cx } from "../../ui/utils"
import { usePharmacyStore } from "../../hooks/usePharmacyStore"

const Pill = ({ s }) => {
    const t = statusTone(s)
    return (
        <span className={cx(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] border",
            t === "green" && "bg-green-50 border-green-200 text-green-700",
            t === "emerald" && "bg-emerald-50 border-emerald-200 text-emerald-700",
            t === "amber" && "bg-amber-50 border-amber-200 text-amber-700",
            t === "rose" && "bg-rose-50 border-rose-200 text-rose-700",
            t === "slate" && "bg-slate-50 border-slate-200 text-slate-700",
        )}>
            {s || "—"}
        </span>
    )
}

export default function DispensePage() {
    const { storeId } = usePharmacyStore()
    const [q, setQ] = useState("")
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const data = await phListDispenses({ store_id: storeId || undefined, q: q || undefined })
            setRows(data || data?.items || [])
        } catch (e) {
            toast.error(e.message || "Failed to load dispenses")
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [storeId])
    useEffect(() => {
        const t = setTimeout(load, 350)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q])

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Dispense</h2>
                        <p className="text-[12px] text-slate-500">Use FEFO for batch selection. Post to reduce stock with audit.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full md:w-80">
                            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                            <input
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search patient / bill / id..."
                            />
                        </div>
                        <Link
                            to="/pharmacy/dispense/new"
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                            <Plus className="h-4 w-4" /> New
                        </Link>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-[12px] text-slate-500">{loading ? "Loading…" : `${rows.length} records`}</p>
                </div>

                <div className="divide-y divide-slate-100">
                    {rows.map((r) => (
                        <Link key={r.id} to={`/pharmacy/dispense/${r.id}`} className="block hover:bg-slate-50/60">
                            <div className="p-4 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">Dispense #{r.id}</p>
                                    <p className="text-[12px] text-slate-500 truncate">
                                        Type: {r.type || "—"} • Date: {fmtDate(r.created_at || r.date)}
                                    </p>
                                </div>
                                <Pill s={r.status} />
                            </div>
                        </Link>
                    ))}
                    {!rows.length && !loading ? (
                        <div className="p-8 text-center text-slate-500">No dispense records.</div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
