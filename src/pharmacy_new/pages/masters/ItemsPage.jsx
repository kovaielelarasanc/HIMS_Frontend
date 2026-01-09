// FILE: src/pharmacy/pages/masters/ItemsPage.jsx
import React, { useEffect, useMemo, useState } from "react"
import { Plus, Search, Trash2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { phCreateItem, phDeleteItem, phListItems, phUpdateItem } from "../../../api/pharmacy_new"
import { cx } from "../../ui/utils"

const Input = (props) => (
    <input
        {...props}
        className={cx(
            "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none",
            "focus:ring-2 focus:ring-slate-900/10",
            props.className
        )}
    />
)

const Select = (props) => (
    <select
        {...props}
        className={cx(
            "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none",
            "focus:ring-2 focus:ring-slate-900/10",
            props.className
        )}
    />
)

const Btn = ({ tone = "dark", ...props }) => (
    <button
        {...props}
        className={cx(
            "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
            tone === "dark" && "bg-slate-900 text-white hover:bg-slate-800",
            tone === "light" && "bg-slate-100 text-slate-900 hover:bg-slate-200",
            tone === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
            props.disabled && "opacity-50 cursor-not-allowed",
            props.className
        )}
    />
)

function ItemEditor({ open, onClose, initial, onSave }) {
    const [form, setForm] = useState(() => ({
        sku: "",
        name: "",
        generic_name: "",
        brand_name: "",
        is_medicine: true,
        is_consumable: false,
        is_device: false,
        prescription_required: true,
        storage_type: "room_temp",
        hsn: "",
        barcode: "",
        default_mrp: "",
        default_sale_price: "",
        min_stock_base: 0,
        reorder_point_base: 0,
        reorder_qty_base: 0,
        max_stock_base: 0,
        is_active: true,
    }))

    useEffect(() => {
        if (!open) return
        setForm((p) => ({ ...p, ...(initial || {}) }))
    }, [open, initial])

    if (!open) return null

    const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-2">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-slate-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">{initial?.id ? "Edit Item" : "New Item"}</h3>
                        <p className="text-[12px] text-slate-500">Keep names consistent for search & insurance contracts.</p>
                    </div>
                    <Btn tone="light" onClick={onClose}>Close</Btn>
                </div>

                <div className="max-h-[70vh] overflow-auto p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">SKU</p>
                            <Input value={form.sku || ""} onChange={(e) => set("sku", e.target.value)} placeholder="Internal code (optional)" />
                        </div>
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Name *</p>
                            <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g., Paracetamol 500mg" />
                        </div>
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Generic name</p>
                            <Input value={form.generic_name || ""} onChange={(e) => set("generic_name", e.target.value)} placeholder="e.g., Acetaminophen" />
                        </div>
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Brand name</p>
                            <Input value={form.brand_name || ""} onChange={(e) => set("brand_name", e.target.value)} placeholder="e.g., Crocin" />
                        </div>

                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Storage</p>
                            <Select value={form.storage_type} onChange={(e) => set("storage_type", e.target.value)}>
                                <option value="room_temp">Room Temp</option>
                                <option value="refrigerated">Refrigerated</option>
                                <option value="frozen">Frozen</option>
                            </Select>
                        </div>
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">HSN</p>
                            <Input value={form.hsn || ""} onChange={(e) => set("hsn", e.target.value)} placeholder="HSN (optional)" />
                        </div>

                        <div className="md:col-span-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                    <input type="checkbox" checked={!!form.is_medicine} onChange={(e) => set("is_medicine", e.target.checked)} />
                                    <span className="text-sm text-slate-700">Medicine</span>
                                </label>
                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                    <input type="checkbox" checked={!!form.is_consumable} onChange={(e) => set("is_consumable", e.target.checked)} />
                                    <span className="text-sm text-slate-700">Consumable</span>
                                </label>
                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                    <input type="checkbox" checked={!!form.is_device} onChange={(e) => set("is_device", e.target.checked)} />
                                    <span className="text-sm text-slate-700">Device</span>
                                </label>
                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                    <input type="checkbox" checked={!!form.prescription_required} onChange={(e) => set("prescription_required", e.target.checked)} />
                                    <span className="text-sm text-slate-700">Rx Required</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Barcode</p>
                            <Input value={form.barcode || ""} onChange={(e) => set("barcode", e.target.value)} placeholder="GTIN / internal" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-[12px] text-slate-500 mb-1">MRP</p>
                                <Input value={form.default_mrp ?? ""} onChange={(e) => set("default_mrp", e.target.value)} placeholder="0.00" />
                            </div>
                            <div>
                                <p className="text-[12px] text-slate-500 mb-1">Sale price</p>
                                <Input value={form.default_sale_price ?? ""} onChange={(e) => set("default_sale_price", e.target.value)} placeholder="0.00" />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <p className="text-[12px] text-slate-500 mb-1">Reorder defaults (base UOM)</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <Input value={form.min_stock_base ?? 0} onChange={(e) => set("min_stock_base", e.target.value)} placeholder="Min" />
                                <Input value={form.reorder_point_base ?? 0} onChange={(e) => set("reorder_point_base", e.target.value)} placeholder="Reorder point" />
                                <Input value={form.reorder_qty_base ?? 0} onChange={(e) => set("reorder_qty_base", e.target.value)} placeholder="Reorder qty" />
                                <Input value={form.max_stock_base ?? 0} onChange={(e) => set("max_stock_base", e.target.value)} placeholder="Max" />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={!!form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
                                <span className="text-sm text-slate-700">Active</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
                    <Btn tone="light" onClick={onClose}>Cancel</Btn>
                    <Btn
                        onClick={() => {
                            if (!String(form.name || "").trim()) return toast.error("Item name is required")
                            onSave(form)
                        }}
                    >
                        Save
                    </Btn>
                </div>
            </div>
        </div>
    )
}

export default function ItemsPage() {
    const [q, setQ] = useState("")
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [editorOpen, setEditorOpen] = useState(false)
    const [editing, setEditing] = useState(null)

    const load = async () => {
        setLoading(true)
        try {
            const data = await phListItems({ q: q || undefined, limit: 200, offset: 0 })
            const list = data?.items || data?.items === 0 ? data.items : (data?.items || data?.items)
            // your stub returns { items: [] ... }
            setRows(Array.isArray(data?.items) ? data.items : [])
        } catch (e) {
            toast.error(e.message || "Failed to load items")
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, []) // initial
    useEffect(() => {
        const t = setTimeout(load, 350)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q])

    const openNew = () => { setEditing(null); setEditorOpen(true) }
    const openEdit = (r) => { setEditing(r); setEditorOpen(true) }

    const save = async (payload) => {
        try {
            if (editing?.id) {
                await phUpdateItem(editing.id, payload)
                toast.success("Item updated")
            } else {
                await phCreateItem(payload)
                toast.success("Item created")
            }
            setEditorOpen(false)
            await load()
        } catch (e) {
            toast.error(e.message || "Save failed")
        }
    }

    const del = async (id) => {
        if (!confirm("Delete this item?")) return
        try {
            await phDeleteItem(id)
            toast.success("Deleted")
            await load()
        } catch (e) {
            toast.error(e.message || "Delete failed")
        }
    }

    const mobileCards = useMemo(() => rows || [], [rows])

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Items</h2>
                        <p className="text-[12px] text-slate-500">Catalog used for GRN, stock, dispense, insurance contract pricing.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full md:w-80">
                            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                            <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / generic / brand..." />
                        </div>
                        <Btn onClick={openNew}><Plus className="h-4 w-4" /> New</Btn>
                    </div>
                </div>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-[12px] text-slate-500">{loading ? "Loading…" : `${rows.length} items`}</p>
                </div>

                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="text-left font-medium px-4 py-3">Name</th>
                            <th className="text-left font-medium px-4 py-3">Generic</th>
                            <th className="text-left font-medium px-4 py-3">Brand</th>
                            <th className="text-left font-medium px-4 py-3">Type</th>
                            <th className="text-right font-medium px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                                <td className="px-4 py-3">
                                    <p className="font-medium text-slate-900">{r.name || `Item #${r.id}`}</p>
                                    <p className="text-[12px] text-slate-500">{r.sku ? `SKU: ${r.sku}` : "—"}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{r.generic_name || "—"}</td>
                                <td className="px-4 py-3 text-slate-700">{r.brand_name || "—"}</td>
                                <td className="px-4 py-3 text-slate-700">
                                    {(r.is_medicine ? "Medicine" : "")}
                                    {(r.is_consumable ? (r.is_medicine ? " • " : "") + "Consumable" : "")}
                                    {(r.is_device ? ((r.is_medicine || r.is_consumable) ? " • " : "") + "Device" : "")}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                        <Btn tone="light" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /> Edit</Btn>
                                        <Btn tone="danger" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /> Delete</Btn>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!rows.length && !loading ? (
                            <tr>
                                <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                                    No items found. Create your first item.
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
                {mobileCards.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{r.name || `Item #${r.id}`}</p>
                                <p className="text-[12px] text-slate-500 truncate">
                                    {r.generic_name || "—"} {r.brand_name ? `• ${r.brand_name}` : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => openEdit(r)} className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center">
                                    <Pencil className="h-4 w-4 text-slate-700" />
                                </button>
                                <button onClick={() => del(r.id)} className="h-9 w-9 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-center">
                                    <Trash2 className="h-4 w-4 text-rose-700" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
                                <p className="text-slate-500">SKU</p>
                                <p className="text-slate-900">{r.sku || "—"}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
                                <p className="text-slate-500">Type</p>
                                <p className="text-slate-900">
                                    {(r.is_medicine ? "Medicine" : "")}
                                    {(r.is_consumable ? (r.is_medicine ? " • " : "") + "Consumable" : "")}
                                    {(r.is_device ? ((r.is_medicine || r.is_consumable) ? " • " : "") + "Device" : "")}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
                {!mobileCards.length && !loading ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm">
                        No items. Tap <span className="font-medium text-slate-900">New</span> to create.
                    </div>
                ) : null}
            </div>

            <ItemEditor open={editorOpen} onClose={() => setEditorOpen(false)} initial={editing} onSave={save} />
        </div>
    )
}
