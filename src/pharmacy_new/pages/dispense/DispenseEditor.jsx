// FILE: src/pharmacy/pages/dispense/DispenseEditor.jsx
import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Plus, Trash2, Save, Send, CheckCircle2, CloudUpload } from "lucide-react"
import { toast } from "sonner"
import {
    phCreateDispense,
    phGetDispense,
    phUpdateDispense,
    phSubmitDispense,
    phApproveDispense,
    phPostDispense,
    phListItems,
    phDispenseFefoSuggest,
} from "../../../api/pharmacy_new"
import { cx } from "../../ui/utils"
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

    const pickedLabel = value?.name || ""

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
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item..." />
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

export default function DispenseEditor({ mode }) {
    const { dispenseId } = useParams()
    const nav = useNavigate()
    const { storeId } = usePharmacyStore()

    const [loading, setLoading] = useState(false)

    const [form, setForm] = useState({
        store_id: storeId || null,
        type: "op", // op/ip/er/ot
        patient_id: null,
        admission_id: null,
        payer_id: null,
        plan_id: null,
        notes: "",
        lines: [
            { item_id: null, item: null, qty_base: 1, fefo_plan: null },
        ],
    })

    useEffect(() => {
        setForm((s) => ({ ...s, store_id: storeId || s.store_id }))
    }, [storeId])

    const load = async () => {
        if (mode === "create") return
        setLoading(true)
        try {
            const data = await phGetDispense(Number(dispenseId))
            setForm((s) => ({ ...s, ...(data || {}) }))
        } catch (e) {
            toast.error(e.message || "Failed to load dispense")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [dispenseId])

    const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))

    const addLine = () =>
        setForm((s) => ({
            ...s,
            lines: [...(s.lines || []), { item_id: null, item: null, qty_base: 1, fefo_plan: null }],
        }))

    const delLine = (idx) =>
        setForm((s) => ({ ...s, lines: (s.lines || []).filter((_, i) => i !== idx) }))

    const updateLine = (idx, patch) =>
        setForm((s) => ({ ...s, lines: (s.lines || []).map((ln, i) => (i === idx ? { ...ln, ...patch } : ln)) }))

    const saveDraft = async () => {
        try {
            if (!form.store_id) return toast.error("Store is required")
            if (!form.lines?.length) return toast.error("At least one line is required")
            for (const ln of form.lines) {
                if (!ln.item_id && !ln.item?.id) return toast.error("Each line must have an item")
                if (Number(ln.qty_base || 0) <= 0) return toast.error("Qty must be > 0")
            }

            const payload = {
                ...form,
                store_id: Number(form.store_id),
                patient_id: form.patient_id ? Number(form.patient_id) : null,
                admission_id: form.admission_id ? Number(form.admission_id) : null,
                payer_id: form.payer_id ? Number(form.payer_id) : null,
                plan_id: form.plan_id ? Number(form.plan_id) : null,
                lines: (form.lines || []).map((ln) => ({
                    item_id: Number(ln.item_id || ln.item?.id),
                    qty_base: Number(ln.qty_base || 0),
                    fefo_plan: ln.fefo_plan || null,
                })),
            }

            if (mode === "create") {
                const created = await phCreateDispense(payload)
                toast.success("Dispense created")
                const newId = created?.id || created?.dispense_id
                if (newId) nav(`/pharmacy/dispense/${newId}`)
                else nav(`/pharmacy/dispense`)
            } else {
                await phUpdateDispense(Number(dispenseId), payload)
                toast.success("Updated")
            }
        } catch (e) {
            toast.error(e.message || "Save failed")
        }
    }

    const suggestFefo = async (idx) => {
        const ln = form.lines[idx]
        if (!storeId) return toast.error("Select store")
        const itemId = Number(ln.item_id || ln.item?.id)
        if (!itemId) return toast.error("Pick item first")
        try {
            const data = await phDispenseFefoSuggest(Number(dispenseId || 0), { item_id: itemId, qty_base: Number(ln.qty_base || 1) })
            updateLine(idx, { fefo_plan: data?.plan || [] })
            toast.success("FEFO suggested")
        } catch (e) {
            toast.error(e.message || "FEFO failed")
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
                            {mode === "create" ? "New Dispense" : `Dispense #${dispenseId}`}
                        </h2>
                        <p className="text-[12px] text-slate-500">Draft → Submit → Approve → Post (Stock OUT)</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Btn tone="light" onClick={() => nav("/pharmacy/dispense")}>Back</Btn>
                        <Btn onClick={saveDraft}><Save className="h-4 w-4" /> Save</Btn>
                        <Btn tone="light" onClick={() => act(() => phSubmitDispense(Number(dispenseId)), "Submitted")} disabled={mode === "create"}>
                            <Send className="h-4 w-4" /> Submit
                        </Btn>
                        <Btn tone="ok" onClick={() => act(() => phApproveDispense(Number(dispenseId)), "Approved")} disabled={mode === "create"}>
                            <CheckCircle2 className="h-4 w-4" /> Approve
                        </Btn>
                        <Btn onClick={() => act(() => phPostDispense(Number(dispenseId)), "Posted (stock reduced)")} disabled={mode === "create"}>
                            <CloudUpload className="h-4 w-4" /> Post
                        </Btn>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Header</h3>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <p className="text-[12px] text-slate-500 mb-1">Type</p>
                        <select
                            value={form.type}
                            onChange={(e) => set("type", e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                        >
                            <option value="op">OP</option>
                            <option value="ip">IP</option>
                            <option value="er">ER</option>
                            <option value="ot">OT</option>
                        </select>
                    </div>

                    <div>
                        <p className="text-[12px] text-slate-500 mb-1">Patient ID (optional)</p>
                        <Input value={form.patient_id || ""} onChange={(e) => set("patient_id", e.target.value)} />
                    </div>

                    <div>
                        <p className="text-[12px] text-slate-500 mb-1">Admission ID (optional)</p>
                        <Input value={form.admission_id || ""} onChange={(e) => set("admission_id", e.target.value)} />
                    </div>

                    <div>
                        <p className="text-[12px] text-slate-500 mb-1">Notes</p>
                        <Input value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
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
                                <Field label="Qty (base)" value={ln.qty_base} onChange={(v) => updateLine(idx, { qty_base: v })} />
                                <div className="md:col-span-2">
                                    <p className="text-[12px] text-slate-500 mb-1">FEFO plan</p>
                                    <button
                                        onClick={() => suggestFefo(idx)}
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50"
                                        type="button"
                                        disabled={mode === "create"} // needs dispenseId endpoint in your backend; once backend supports suggest without id, remove this
                                    >
                                        Suggest FEFO
                                    </button>
                                </div>
                            </div>

                            {ln.fefo_plan ? (
                                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2">
                                    <p className="text-[12px] text-slate-500 mb-1">Plan JSON</p>
                                    <pre className="text-xs overflow-auto">{JSON.stringify(ln.fefo_plan, null, 2)}</pre>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>

                {loading ? <p className="mt-2 text-[12px] text-slate-500">Loading…</p> : null}
            </div>
        </div>
    )
}

function Field({ label, value, onChange }) {
    return (
        <div>
            <p className="text-[12px] text-slate-500 mb-1">{label}</p>
            <input
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            />
        </div>
    )
}
