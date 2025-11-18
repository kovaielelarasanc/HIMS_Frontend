// src/lab/Masters.jsx
import { useEffect, useMemo, useState } from 'react'
import { listLabTests, createLabTest, updateLabTest, deleteLabTest } from '../api/lab'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import PermGate from '../components/PermGate'

export default function Masters() {
    const [q, setQ] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [editing, setEditing] = useState(null) // object or null
    const [panelOpen, setPanelOpen] = useState(false)

    const fetchRows = async () => {
        setLoading(true)
        try {
            const { data } = await listLabTests({ q, page_size: 200 })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load tests')
        } finally { setLoading(false) }
    }

    useEffect(() => { fetchRows() }, [q])

    const startCreate = () => {
        setEditing({ code: '', name: '', price: 0, is_active: true })
        setPanelOpen(true)
    }
    const startEdit = (row) => { setEditing({ ...row }); setPanelOpen(true) }

    const onSave = async () => {
        try {
            if (editing?.id) {
                await updateLabTest(editing.id, editing)
                toast.success('Updated')
            } else {
                await createLabTest(editing)
                toast.success('Created')
            }
            setPanelOpen(false)
            fetchRows()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Save failed')
        }
    }

    const onDelete = async (id) => {
        if (!confirm('Delete this test?')) return
        try {
            await deleteLabTest(id)
            toast.success('Deleted')
            fetchRows()
        } catch (e) {
            toast.error('Delete failed')
        }
    }

    const total = useMemo(() => rows.length, [rows])

    return (
        <div className="p-4 md:p-6">
            <header className="mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Lab Masters</h1>
                    <p className="text-xs text-gray-500">Manage NABL-friendly test catalogue</p>
                </div>
                <PermGate anyOf={['lab.masters.manage', 'masters.lab.manage']}>
                    <button className="btn-primary" onClick={startCreate}>
                        <Plus className="h-4 w-4 mr-2" /> New Test
                    </button>
                </PermGate>
            </header>

            <div className="mb-3">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        className="input pl-9"
                        placeholder="Search code/name"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-xl border bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Code</th>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-right">Price</th>
                            <th className="px-3 py-2 text-left">Active</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td className="px-3 py-3" colSpan={5}>Loading…</td></tr>
                        )}
                        {!loading && rows.map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">{r.code}</td>
                                <td className="px-3 py-2">{r.name}</td>
                                <td className="px-3 py-2 text-right">₹{Number(r.price || 0).toFixed(2)}</td>
                                <td className="px-3 py-2">{r.is_active ? 'Yes' : 'No'}</td>
                                <td className="px-3 py-2 text-right">
                                    <PermGate anyOf={['lab.masters.manage', 'masters.lab.manage']}>
                                        <button className="btn-ghost mr-2" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></button>
                                        <button className="btn-ghost text-red-600" onClick={() => onDelete(r.id)}><Trash2 className="h-4 w-4" /></button>
                                    </PermGate>
                                </td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={5}>No tests</td></tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="px-3 py-2 text-xs text-gray-500" colSpan={5}>Total: {total}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Side panel */}
            {panelOpen && (
                <div className="fixed inset-0 z-40">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setPanelOpen(false)} />
                    <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl p-4 overflow-y-auto">
                        <h2 className="text-lg font-semibold mb-4">{editing?.id ? 'Edit Test' : 'New Test'}</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm">Code</label>
                                <input className="input" value={editing?.code || ''} onChange={e => setEditing(s => ({ ...s, code: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-sm">Name</label>
                                <input className="input" value={editing?.name || ''} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-sm">Price</label>
                                <input type="number" step="0.01" className="input" value={editing?.price ?? 0}
                                    onChange={e => setEditing(s => ({ ...s, price: parseFloat(e.target.value || 0) }))} />
                            </div>
                            <div className="flex items-center gap-2">
                                <input id="active" type="checkbox" checked={!!editing?.is_active}
                                    onChange={e => setEditing(s => ({ ...s, is_active: e.target.checked }))} />
                                <label htmlFor="active" className="text-sm">Active</label>
                            </div>
                            <div className="flex justify-end gap-2 pt-3">
                                <button className="btn-ghost" onClick={() => setPanelOpen(false)}>Cancel</button>
                                <button className="btn-primary" onClick={onSave}>Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
