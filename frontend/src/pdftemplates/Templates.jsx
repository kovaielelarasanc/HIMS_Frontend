// frontend/src/pdftemplate/Templates.jsx

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listTemplates, deleteTemplate } from '../api/templates'
import { toast } from 'sonner'

export default function Templates() {
    const [rows, setRows] = useState([])
    const [q, setQ] = useState('')
    const [category, setCategory] = useState('')
    const [loading, setLoading] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const res = await listTemplates({ q, category: category || undefined })
            setRows(res.data || [])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, []) // initial

    const onSearch = async (e) => {
        e.preventDefault()
        load()
    }

    const remove = async (id) => {
        if (!confirm('Delete this template?')) return
        try {
            await deleteTemplate(id)
            toast.success('Deleted')
            load()
        } catch { }
    }

    return (
        <div className="p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
                <h1 className="text-xl font-semibold">Templates</h1>
                <Link to="/templates/new" className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm">
                    New Template
                </Link>
            </div>

            <form onSubmit={onSearch} className="mb-3 flex flex-wrap gap-2">
                <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Search name/code..."
                    className="border rounded px-3 py-2 text-sm"
                />
                <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="border rounded px-3 py-2 text-sm"
                >
                    <option value="">All</option>
                    <option value="report">Report</option>
                    <option value="consent">Consent</option>
                </select>
                <button className="px-3 py-2 border rounded text-sm">Filter</button>
            </form>

            <div className="overflow-x-auto bg-white border rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left">#</th>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">Code</th>
                            <th className="px-3 py-2 text-left">Category</th>
                            <th className="px-3 py-2 text-left">Version</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">{r.id}</td>
                                <td className="px-3 py-2">{r.name}</td>
                                <td className="px-3 py-2">{r.code}</td>
                                <td className="px-3 py-2 capitalize">{r.category}</td>
                                <td className="px-3 py-2">{r.version}</td>
                                <td className="px-3 py-2 text-right">
                                    <Link
                                        to={`/templates/${r.id}/edit`}
                                        className="px-2 py-1 text-blue-700 hover:underline"
                                    >Edit</Link>
                                    <button
                                        onClick={() => remove(r.id)}
                                        className="px-2 py-1 text-red-600 hover:underline"
                                    >Delete</button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && !loading && (
                            <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No templates</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
