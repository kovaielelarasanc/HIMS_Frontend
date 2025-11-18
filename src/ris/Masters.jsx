// src/ris/Masters.jsx
import { useEffect, useState } from 'react'
import { listRisTests, createRisTest, updateRisTest, deleteRisTest } from '../api/ris'
import { toast } from 'sonner'
import PermGate from '../components/PermGate'

function TestRow({ t, onEdit, onDelete }) {
    return (
        <tr className="border-t">
            <td className="px-3 py-2">{t.code}</td>
            <td className="px-3 py-2">{t.name}</td>
            <td className="px-3 py-2">{t.modality || '—'}</td>
            <td className="px-3 py-2">{Number(t.price || 0).toFixed(2)}</td>
            <td className="px-3 py-2 text-right">
                <PermGate anyOf={['radiology.masters.manage', 'masters.ris.manage']}>
                    <button className="btn-ghost mr-2" onClick={() => onEdit(t)}>Edit</button>
                    <button className="btn-ghost text-rose-600" onClick={() => onDelete(t)}>Delete</button>
                </PermGate>
            </td>
        </tr>
    )
}

export default function RisMasters() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [q, setQ] = useState('')
    const [form, setForm] = useState({ code: '', name: '', modality: '', price: 0 })
    const [editingId, setEditingId] = useState(null)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listRisTests({ q, page_size: 100 })
            setRows(Array.isArray(data) ? data : (data?.items || []))
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() /* eslint-disable-next-line */ }, [q])

    const submit = async () => {
        try {
            if (editingId) {
                await updateRisTest(editingId, form)
                toast.success('Updated')
            } else {
                await createRisTest(form)
                toast.success('Created')
            }
            setForm({ code: '', name: '', modality: '', price: 0 })
            setEditingId(null)
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Save failed')
        }
    }

    const onEdit = (t) => {
        setEditingId(t.id)
        setForm({ code: t.code, name: t.name, modality: t.modality || '', price: t.price || 0 })
    }
    const onDelete = async (t) => {
        if (!window.confirm(`Delete ${t.code}?`)) return
        try {
            await deleteRisTest(t.id)
            toast.success('Deleted')
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    return (
        <div className="space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">RIS Masters</h1>
                    <p className="text-sm text-gray-500">Manage radiology tests & modalities.</p>
                </div>
                <input className="input w-60" placeholder="Search code/name…" value={q} onChange={e => setQ(e.target.value)} />
            </header>

            <PermGate anyOf={['radiology.masters.manage', 'masters.ris.manage']}>
                <div className="rounded-2xl border bg-white p-4">
                    <h3 className="text-sm font-semibold mb-3">{editingId ? 'Edit Test' : 'New Test'}</h3>
                    <div className="grid gap-3 md:grid-cols-4">
                        <input className="input" placeholder="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                        <input className="input" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                        <input className="input" placeholder="Modality (XR/CT/MRI/USG…)" value={form.modality} onChange={e => setForm(f => ({ ...f, modality: e.target.value }))} />
                        <input className="input" placeholder="Price" type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <button className="btn" onClick={submit}>{editingId ? 'Update' : 'Create'}</button>
                        {editingId && <button className="btn-ghost" onClick={() => { setEditingId(null); setForm({ code: '', name: '', modality: '', price: 0 }) }}>Cancel</button>}
                    </div>
                </div>
            </PermGate>

            <div className="rounded-xl border bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Code</th>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">Modality</th>
                            <th className="px-3 py-2 text-left">Price</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (<tr><td className="px-3 py-3" colSpan={5}>Loading…</td></tr>)}
                        {!loading && rows.map(t => (
                            <TestRow key={t.id} t={t} onEdit={onEdit} onDelete={onDelete} />
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={5}>No tests</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
