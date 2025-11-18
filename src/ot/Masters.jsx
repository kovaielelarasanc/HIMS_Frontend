import { useEffect, useState } from 'react'
import { listOtSurgeries, createOtSurgery, updateOtSurgery, deleteOtSurgery } from '../api/ot'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, RefreshCw  } from 'lucide-react'
import { useCan } from '../hooks/usePerm'

export default function OtMasters() {
    const canManage = useCan('ot.masters.manage') || useCan('ot.masters.view')
    const canEdit = useCan('ot.masters.manage')
    const [rows, setRows] = useState([])
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(true)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listOtSurgeries({ q, page: 1, page_size: 100 })
            setRows(data.items || [])
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load surgeries')
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, []) // first load

    const [form, setForm] = useState({ id: null, code: '', name: '', default_cost: '', active: true })
    const [open, setOpen] = useState(false)

    const onNew = () => { setForm({ id: null, code: '', name: '', default_cost: '', active: true }); setOpen(true) }
    const onEdit = (r) => { setForm({ ...r }); setOpen(true) }

    const onSave = async () => {
        if (!form.code.trim() || !form.name.trim()) return toast.error('Code and Name are required')
        try {
            if (form.id) {
                await updateOtSurgery(form.id, {
                    code: form.code.trim(),
                    name: form.name.trim(),
                    default_cost: Number(form.default_cost || 0),
                    active: !!form.active,
                })
                toast.success('Updated')
            } else {
                await createOtSurgery({
                    code: form.code.trim(),
                    name: form.name.trim(),
                    default_cost: Number(form.default_cost || 0),
                    active: !!form.active,
                })
                toast.success('Created')
            }
            setOpen(false)
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Save failed')
        }
    }

    const onDelete = async (id) => {
        if (!confirm('Delete this surgery master?')) return
        try {
            await deleteOtSurgery(id)
            toast.success('Deleted')
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    return (
        <div className="p-4 space-y-4">
            <header className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">OT Masters</h1>
                <div className="flex gap-2">
                    <input className="input" placeholder="Search name/code…" value={q} onChange={e => setQ(e.target.value)} />
                    <button className="btn-ghost" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Refresh</button>
                    {canEdit && <button className="btn" onClick={onNew}><Plus className="h-4 w-4 mr-2" />New Surgery</button>}
                </div>
            </header>

            <div className="rounded-xl border bg-white overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Code</th>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">Default Cost</th>
                            <th className="px-3 py-2 text-left">Active</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td className="px-3 py-3" colSpan={5}>Loading…</td></tr>}
                        {!loading && rows.map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">{r.code}</td>
                                <td className="px-3 py-2">{r.name}</td>
                                <td className="px-3 py-2">₹ {Number(r.default_cost || 0).toFixed(2)}</td>
                                <td className="px-3 py-2">{r.active ? 'Yes' : 'No'}</td>
                                <td className="px-3 py-2 text-right">
                                    {canEdit && (
                                        <>
                                            <button className="btn-ghost mr-2" onClick={() => onEdit(r)}><Pencil className="h-4 w-4" /></button>
                                            <button className="btn-ghost text-red-600" onClick={() => onDelete(r.id)}><Trash2 className="h-4 w-4" /></button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={5}>No items</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Simple modal */}
            {open && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
                    <div className="w-full max-w-lg rounded-xl border bg-white p-4" onClick={e => e.stopPropagation()}>
                        <h3 className="font-medium mb-3">{form.id ? 'Edit Surgery' : 'New Surgery'}</h3>
                        <div className="grid gap-3">
                            <input className="input" placeholder="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                            <input className="input" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            <input className="input" placeholder="Default Cost" type="number" value={form.default_cost} onChange={e => setForm(f => ({ ...f, default_cost: e.target.value }))} />
                            <label className="inline-flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                                Active
                            </label>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                            <button className="btn" onClick={onSave}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
