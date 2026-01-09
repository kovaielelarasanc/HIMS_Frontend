// FILE: src/pharmacy/pages/procurement/GrnEditor.jsx
import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Plus, Trash2, Save, Send, CheckCircle2, XCircle, CloudUpload } from "lucide-react"
import { toast } from "sonner"
import {
    phCreateGRN,
    phGetGRN,
    phUpdateGRN,
    phSubmitGRN,
    phApproveGRN,
    phCancelGRN,
    phRecalcGRN,
    phPostGRN,
    phListItems,
} from "../../../api/pharmacy_new"
import { cx, money, fmtDate } from "../../ui/utils"
import { usePharmacyStore } from "../../hooks/usePharmacyStore"

const Input = (p) => (
    <input
        {...p}
        className={cx(
            "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none",
            "focus:ring-2 focus:ring-slate-900/10",
            p.className
        )}
    />
)

const Btn = ({ tone = "dark", ...p }) => (
    <button
        {...p}
        className={cx(
            "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
            tone === "dark" && "bg-slate-900 text-white hover:bg-slate-800",
            tone === "light" && "bg-slate-100 text-slate-900 hover:bg-slate-200",
            tone === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
            tone === "ok" && "bg-emerald-600 text-white hover:bg-emerald-700",
            p.disabled && "opacity-50 cursor-not-allowed",
            p.className
        )}
    />
)

function ItemPicker({ value, onPick }) {
    const [q, setQ] = useState("")
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open) return
        const t = setTimeout(async () => {
            const term = (q || "").trim()
            if (term.length < 2) { setItems([]); return }
            setLoading(true)
            try {
                const data = await phListItems({ q: term, limit: 25, offset: 0 })
                setItems(data?.items || [])
            } finally {
                setLoading(false)
            }
        }, 250)
        return () => clearTimeout(t)
    }, [q, open])

    const pickedLabel = value?.name || (value?.item_name ?? "") || ""

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((s) => !s)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-left text-sm shadow-sm hover:bg-slate-50"
            >
                <span className={pickedLabel ? "text-slate-900" : "text-slate-400"}>
                    {pickedLabel || "Pick item"}
                </span>
            </button>

            {open ? (
                <div className="absolute z-30 mt-2 w-[320px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="p-2 border-b border-slate-200">
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item name..." />
                    </div>
                    <div className="max-h-72 overflow-auto p-2">
                        {loading ? <p className="p-2 text-sm text-slate-500">Loading…</p> : null}
                        {items.map((it) => (
                            <button
                                key={it.id}
                                type="button"
                                onClick={() => { onPick(it); setOpen(false); setQ("") }}
                                className="w-full rounded-xl p-2 text-left hover:bg-slate-50"
                            >
                                <p className="text-sm font-medium text-slate-900">{it.name}</p>
                                <p className="text-[12px] text-slate-500">{it.generic_name || "—"} {it.brand_name ? `• ${it.brand_name}` : ""}</p>
                            </button>
                        ))}
                        {!items.length && !loading ? (
                            <p className="p-2 text-sm text-slate-500">Type at least 2 characters.</p>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default function GrnEditor({ mode }) {
    const { grnId } = useParams()
    const nav = useNavigate()
    const { storeId } = usePharmacyStore()

    const [loading, setLoading] = useState(false)
    const [doc, setDoc] = useState(null)

    const [form, setForm] = useState({
        store_id: storeId || null,
        supplier_id: null,
        supplier_name: "",
        invoice_no: "",
        grn_date: new Date().toISOString().slice(0, 10),
        charges: 0,
        round_off: 0,
        notes: "",
        lines: [
            {
                item_id: null,
                item: null,
                batch_no: "",
                expiry_date: "",
                received_qty: 0,
                free_qty: 0,
                purchase_rate: 0,
                discount_percent: 0,
                gst_percent: 0,
            },
        ],
    })

    useEffect(() => {
        setForm((s) => ({ ...s, store_id: storeId || s.store_id }))
    }, [storeId])

    const load = async () => {
        if (mode === "create") return
        setLoading(true)
        try {
            const data = await phGetGRN(Number(grnId))
            setDoc(data)
            // if backend returns full document later, map it here
            setForm((s) => ({ ...s, ...(data || {}) }))
        } catch (e) {
            toast.error(e.message || "Failed to load GRN")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [grnId])

    const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))

    const addLine = () =>
        setForm((s) => ({
            ...s,
            lines: [
                ...(s.lines || []),
                {
                    item_id: null,
                    item: null,
                    batch_no: "",
                    expiry_date: "",
                    received_qty: 0,
                    free_qty: 0,
                    purchase_rate: 0,
                    discount_percent: 0,
                    gst_percent: 0,
                },
            ],
        }))

    const delLine = (idx) =>
        setForm((s) => ({
            ...s,
            lines: (s.lines || []).filter((_, i) => i !== idx),
        }))

    const updateLine = (idx, patch) =>
        setForm((s) => ({
            ...s,
            lines: (s.lines || []).map((ln, i) => (i === idx ? { ...ln, ...patch } : ln)),
        }))

    const computed = useMemo(() => {
        const lines = form.lines || []
        let sub = 0
        let tax = 0
        for (const ln of lines) {
            const qty = Number(ln.received_qty || 0)
            const rate = Number(ln.purchase_rate || 0)
            const discP = Number(ln.discount_percent || 0)
            const gstP = Number(ln.gst_percent || 0)

            const lineBase = qty * rate
            const disc = lineBase * (discP / 100)
            const afterDisc = lineBase - disc
            const gst = afterDisc * (gstP / 100)
            sub += afterDisc
            tax += gst
        }
        const charges = Number(form.charges || 0)
        const round = Number(form.round_off || 0)
        const total = sub + tax + charges + round
        return { sub, tax, charges, round, total }
    }, [form])

    const saveDraft = async () => {
        try {
            if (!form.store_id) return toast.error("Store is required")
            if (!String(form.supplier_name || "").trim() && !form.supplier_id) {
                return toast.error("Supplier is required (name or supplier_id)")
            }
            if (!form.lines?.length) return toast.error("At least one line is required")
            for (const ln of form.lines) {
                if (!ln.item_id && !ln.item?.id) return toast.error("Each line must have an item")
            }

            const payload = {
                ...form,
                store_id: Number(form.store_id),
                supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
                lines: (form.lines || []).map((ln) => ({
                    item_id: Number(ln.item_id || ln.item?.id),
                    batch_no: ln.batch_no || null,
                    expiry_date: ln.expiry_date || null,
                    received_qty: Number(ln.received_qty || 0),
                    free_qty: Number(ln.free_qty || 0),
                    purchase_rate: Number(ln.purchase_rate || 0),
                    discount_percent: Number(ln.discount_percent || 0),
                    gst_percent: Number(ln.gst_percent || 0),
                })),
            }

            if (mode === "create") {
                const created = await phCreateGRN(payload)
                toast.success("GRN created")
                // if backend returns created id, route to it
                const newId = created?.id || created?.grn_id
                if (newId) nav(`/pharmacy/proc/grns/${newId}`)
                else nav(`/pharmacy/proc/grns`)
            } else {
                await phUpdateGRN(Number(grnId), payload)
                toast.success("GRN updated")
            }
        } catch (e) {
            toast.error(e.message || "Save failed")
        }
    }

    const act = async (fn, okMsg) => {
        try {
            await fn()
            toast.success(okMsg)
            await load()
        } catch (e) {
            toast.error(e.message || "Action failed")
        }
    }

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                            {mode === "create" ? "New GRN" : `GRN #${grnId}`}
                        </h2>
                        <p className="text-[12px] text-slate-500">Draft → Submit → Approve → Post (Stock IN)</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Btn tone="light" onClick={() => nav("/pharmacy/proc/grns")}>Back</Btn>
                        <Btn tone="light" onClick={() => act(() => phRecalcGRN(Number(grnId)), "Recalculated")} disabled={mode === "create"}>
                            <CloudUpload className="h-4 w-4" /> Recalc
                        </Btn>
                        <Btn onClick={saveDraft}><Save className="h-4 w-4" /> Save</Btn>
                        <Btn tone="light" onClick={() => act(() => phSubmitGRN(Number(grnId)), "Submitted")} disabled={mode === "create"}>
                            <Send className="h-4 w-4" /> Submit
                        </Btn>
                        <Btn tone="ok" onClick={() => act(() => phApproveGRN(Number(grnId)), "Approved")} disabled={mode === "create"}>
                            <CheckCircle2 className="h-4 w-4" /> Approve
                        </Btn>
                        <Btn onClick={() => act(() => phPostGRN(Number(grnId)), "Posted to stock")} disabled={mode === "create"}>
                            <CloudUpload className="h-4 w-4" /> Post
                        </Btn>
                        <Btn tone="danger" onClick={() => act(() => phCancelGRN(Number(grnId), { reason: "User cancelled" }), "Cancelled")} disabled={mode === "create"}>
                            <XCircle className="h-4 w-4" /> Cancel
                        </Btn>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">Header</h3>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Store ID</p>
                            <Input value={form.store_id || ""} onChange={(e) => set("store_id", e.target.value)} placeholder="Store ID" />
                        </div>
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Supplier ID (optional)</p>
                            <Input value={form.supplier_id || ""} onChange={(e) => set("supplier_id", e.target.value)} placeholder="Supplier ID" />
                        </div>
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Supplier name *</p>
                            <Input value={form.supplier_name || ""} onChange={(e) => set("supplier_name", e.target.value)} placeholder="Supplier name" />
                        </div>

                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Invoice No</p>
                            <Input value={form.invoice_no || ""} onChange={(e) => set("invoice_no", e.target.value)} placeholder="Invoice reference" />
                        </div>
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">GRN Date</p>
                            <Input type="date" value={form.grn_date || ""} onChange={(e) => set("grn_date", e.target.value)} />
                        </div>
                        <div>
                            <p className="text-[12px] text-slate-500 mb-1">Notes</p>
                            <Input value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">Totals</h3>
                    <div className="mt-3 space-y-2 text-sm">
                        <Row label="Sub-total" val={money(computed.sub)} />
                        <Row label="Tax" val={money(computed.tax)} />
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-[12px] text-slate-500 mb-1">Charges</p>
                                <Input value={form.charges ?? 0} onChange={(e) => set("charges", e.target.value)} />
                            </div>
                            <div>
                                <p className="text-[12px] text-slate-500 mb-1">Round off</p>
                                <Input value={form.round_off ?? 0} onChange={(e) => set("round_off", e.target.value)} />
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                            <Row label="Grand total" val={money(computed.total)} strong />
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Lines</h3>
                    <Btn tone="light" onClick={addLine}><Plus className="h-4 w-4" /> Add line</Btn>
                </div>

                <div className="mt-3 space-y-2">
                    {(form.lines || []).map((ln, idx) => (
                        <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 w-full">
                                    <p className="text-[12px] text-slate-500 mb-1">Item</p>
                                    <ItemPicker
                                        value={ln.item}
                                        onPick={(it) => updateLine(idx, { item: it, item_id: it.id })}
                                    />
                                </div>
                                <button
                                    onClick={() => delLine(idx)}
                                    className="h-10 w-10 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-center"
                                    title="Remove"
                                >
                                    <Trash2 className="h-4 w-4 text-rose-700" />
                                </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
                                <Field label="Batch" value={ln.batch_no} onChange={(v) => updateLine(idx, { batch_no: v })} />
                                <Field label="Expiry" type="date" value={ln.expiry_date} onChange={(v) => updateLine(idx, { expiry_date: v })} />
                                <Field label="Recv Qty" value={ln.received_qty} onChange={(v) => updateLine(idx, { received_qty: v })} />
                                <Field label="Free Qty" value={ln.free_qty} onChange={(v) => updateLine(idx, { free_qty: v })} />
                                <Field label="Rate" value={ln.purchase_rate} onChange={(v) => updateLine(idx, { purchase_rate: v })} />
                                <Field label="Disc%" value={ln.discount_percent} onChange={(v) => updateLine(idx, { discount_percent: v })} />
                                <Field label="GST%" value={ln.gst_percent} onChange={(v) => updateLine(idx, { gst_percent: v })} />
                            </div>
                        </div>
                    ))}
                </div>

                {loading ? <p className="mt-2 text-[12px] text-slate-500">Loading…</p> : null}
            </div>
        </div>
    )
}

function Row({ label, val, strong }) {
    return (
        <div className="flex items-center justify-between">
            <p className={cx("text-slate-600", strong && "font-semibold text-slate-900")}>{label}</p>
            <p className={cx("text-slate-900", strong && "font-semibold")}>{val}</p>
        </div>
    )
}

function Field({ label, value, onChange, type = "text" }) {
    return (
        <div>
            <p className="text-[12px] text-slate-500 mb-1">{label}</p>
            <input
                type={type}
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            />
        </div>
    )
}
