// FILE: src/pharmacy/pages/stock/StockPage.jsx
import React, { useEffect, useState } from "react"
import { toast } from "sonner"
import { Search, Sparkles } from "lucide-react"
import { phFefoSuggest, phListStockBalances } from "../../../api/pharmacy_new"
import { usePharmacyStore } from "../../hooks/usePharmacyStore"
import { cx, fmtDate } from "../../ui/utils"

export default function StockPage() {
    const { storeId } = usePharmacyStore()
    const [q, setQ] = useState("")
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [fefo, setFefo] = useState(null)
    const [fefoItemId, setFefoItemId] = useState("")
    const [fefoQty, setFefoQty] = useState("1")

    const load = async () => {
        setLoading(true)
        try {
            const data = await phListStockBalances({
                store_id: storeId || undefined,
                q: q || undefined,
                limit: 200,
                offset: 0,
            })
            setRows(data?.items || [])
        } catch (e) {
            toast.error(e.message || "Failed to load stock")
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

    const runFefo = async () => {
        if (!storeId) return toast.error("Select store first")
        if (!fefoItemId) return toast.error("Enter item_id")
        try {
            const data = await phFefoSuggest({ store_id: storeId, item_id: Number(fefoItemId), qty_base: Number(fefoQty || 1) })
            setFefo(data)
            toast.success("FEFO plan generated")
        } catch (e) {
            toast.error(e.message || "FEFO failed")
        }
    }

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Stock</h2>
                        <p className="text-[12px] text-slate-500">Balances by store and batches. Ledger is source of truth.</p>
                    </div>
                    <div className="relative w-full md:w-96">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                        <input
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search item / batch / barcode..."
                        />
                    </div>
                </div>
            </div>

            {/* FEFO */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">FEFO Suggestion</h3>
                        <p className="text-[12px] text-slate-500">Pick earliest-expiry batches first (safe dispensing).</p>
                    </div>
                    <button
                        onClick={runFefo}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                        <Sparkles className="h-4 w-4" /> Suggest
                    </button>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
                    <Field label="item_id" value={fefoItemId} onChange={setFefoItemId} />
                    <Field label="qty_base" value={fefoQty} onChange={setFefoQty} />
                </div>

                {fefo?.plan ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[12px] text-slate-500 mb-2">Plan</p>
                        <pre className="text-xs overflow-auto">{JSON.stringify(fefo.plan, null, 2)}</pre>
                    </div>
                ) : null}
            </div>

            {/* Balances */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-[12px] text-slate-500">{loading ? "Loading…" : `${rows.length} rows`}</p>
                </div>

                <div className="hidden md:block">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="text-left font-medium px-4 py-3">Item</th>
                                <th className="text-left font-medium px-4 py-3">Batch</th>
                                <th className="text-left font-medium px-4 py-3">Expiry</th>
                                <th className="text-right font-medium px-4 py-3">On hand</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={r.id || i} className="border-t border-slate-100 hover:bg-slate-50/60">
                                    <td className="px-4 py-3 text-slate-900 font-medium">{r.item_name || r.item_id || "—"}</td>
                                    <td className="px-4 py-3 text-slate-700">{r.batch_no || r.batch_id || "—"}</td>
                                    <td className="px-4 py-3 text-slate-700">{fmtDate(r.expiry_date)}</td>
                                    <td className="px-4 py-3 text-right text-slate-900">{r.on_hand ?? r.qty ?? "—"}</td>
                                </tr>
                            ))}
                            {!rows.length && !loading ? (
                                <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={4}>No stock rows.</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                {/* mobile cards */}
                <div className="md:hidden p-3 space-y-2">
                    {rows.map((r, i) => (
                        <div key={r.id || i} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-sm font-semibold text-slate-900">{r.item_name || `Item ${r.item_id || "—"}`}</p>
                            <p className="text-[12px] text-slate-500">Batch: {r.batch_no || r.batch_id || "—"} • Exp: {fmtDate(r.expiry_date)}</p>
                            <div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 p-2 flex items-center justify-between">
                                <p className="text-[12px] text-slate-500">On hand</p>
                                <p className="text-sm font-semibold text-slate-900">{r.on_hand ?? r.qty ?? "—"}</p>
                            </div>
                        </div>
                    ))}
                    {!rows.length && !loading ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">No stock.</div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function Field({ label, value, onChange }) {
    return (
        <div>
            <p className="text-[12px] text-slate-500 mb-1">{label}</p>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            />
        </div>
    )
}
