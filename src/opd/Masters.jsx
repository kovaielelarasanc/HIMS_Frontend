import { useEffect, useState } from 'react'
// import { createMedicine, fetchMedicines, fetchLabTests, createLabTest, fetchRadiologyTests, createRadiologyTest } from '../api/opd'

export default function Masters() {
    const [tab, setTab] = useState('meds')
    return (
        <div className="space-y-4">
            <h1 className="text-xl font-semibold">OPD Masters</h1>
            <div className="rounded-2xl border bg-white">
                <div className="flex gap-1 border-b p-2">
                    {['meds', 'lab', 'ris'].map(t => (
                        <button key={t}
                            onClick={() => setTab(t)}
                            className={`px-3 py-2 text-sm rounded-xl ${tab === t ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
                            {({ meds: 'Medicines', lab: 'Lab Tests', ris: 'Radiology Tests' })[t]}
                        </button>
                    ))}
                </div>
                {tab === 'meds' && <Meds />}
                {tab === 'lab' && <Lab />}
                {tab === 'ris' && <Ris />}
            </div>
        </div>
    )
}

function Meds() {
    const [q, setQ] = useState('')
    const [list, setList] = useState([])
    const [form, setForm] = useState({ name: '', form: 'tablet', unit: 'per tab', price_per_unit: '' })

    const load = async () => { const { data } = await fetchMedicines(q); setList(data || []) }
    useEffect(() => { load() }, [q])

    const add = async (e) => { e.preventDefault(); await createMedicine({ ...form, price_per_unit: Number(form.price_per_unit) || 0 }); setForm({ name: '', form: 'tablet', unit: 'per tab', price_per_unit: '' }); load() }

    return (
        <div className="p-4 grid gap-4 md:grid-cols-2">
            <form onSubmit={add} className="space-y-2 rounded-xl border p-3">
                <div className="text-sm font-medium">Add Medicine</div>
                <input className="input" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <div className="grid gap-2 grid-cols-2">
                    <input className="input" placeholder="Form (tablet/syrup…)" value={form.form} onChange={e => setForm(f => ({ ...f, form: e.target.value }))} />
                    <input className="input" placeholder="Unit (per tab/per 100ml)" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                </div>
                <input className="input" placeholder="Price" value={form.price_per_unit} onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value.replace(/[^\d.]/g, '') }))} />
                <button className="btn">Save</button>
            </form>

            <div>
                <input className="input mb-2" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
                <div className="grid gap-2 sm:grid-cols-2">
                    {list.map(m => (
                        <div key={m.id} className="rounded-xl border p-3">
                            <div className="text-sm font-semibold">{m.name}</div>
                            <div className="text-xs text-gray-500">{m.form} · {m.unit}</div>
                            <div className="text-xs">₹{m.price_per_unit}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function Lab() {
    const [q, setQ] = useState(''); const [list, setList] = useState([]); const [form, setForm] = useState({ code: '', name: '', price: '' })
    const load = async () => { const { data } = await fetchLabTests(q); setList(data || []) }
    useEffect(() => { load() }, [q])
    const add = async (e) => { e.preventDefault(); await createLabTest({ ...form, price: Number(form.price) || 0 }); setForm({ code: '', name: '', price: '' }); load() }
    return (
        <div className="p-4 grid gap-4 md:grid-cols-2">
            <form onSubmit={add} className="space-y-2 rounded-xl border p-3">
                <div className="text-sm font-medium">Add Lab Test</div>
                <input className="input" placeholder="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                <input className="input" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input className="input" placeholder="Price" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value.replace(/[^\d.]/g, '') }))} />
                <button className="btn">Save</button>
            </form>
            <div>
                <input className="input mb-2" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
                <div className="grid gap-2 sm:grid-cols-2">
                    {list.map(t => (
                        <div key={t.id} className="rounded-xl border p-3">
                            <div className="text-sm font-semibold">{t.name}</div>
                            <div className="text-xs text-gray-500">{t.code}</div>
                            <div className="text-xs">₹{t.price}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function Ris() {
    const [q, setQ] = useState(''); const [list, setList] = useState([]); const [form, setForm] = useState({ code: '', name: '', price: '' })
    const load = async () => { const { data } = await fetchRadiologyTests(q); setList(data || []) }
    useEffect(() => { load() }, [q])
    const add = async (e) => { e.preventDefault(); await createRadiologyTest({ ...form, price: Number(form.price) || 0 }); setForm({ code: '', name: '', price: '' }); load() }
    return (
        <div className="p-4 grid gap-4 md:grid-cols-2">
            <form onSubmit={add} className="space-y-2 rounded-xl border p-3">
                <div className="text-sm font-medium">Add Radiology Test</div>
                <input className="input" placeholder="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                <input className="input" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input className="input" placeholder="Price" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value.replace(/[^\d.]/g, '') }))} />
                <button className="btn">Save</button>
            </form>
            <div>
                <input className="input mb-2" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
                <div className="grid gap-2 sm:grid-cols-2">
                    {list.map(t => (
                        <div key={t.id} className="rounded-xl border p-3">
                            <div className="text-sm font-semibold">{t.name}</div>
                            <div className="text-xs text-gray-500">{t.code}</div>
                            <div className="text-xs">₹{t.price}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
