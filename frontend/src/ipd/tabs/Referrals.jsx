import { useEffect, useState } from 'react'
import { listReferrals, addReferral } from '../../api/ipd'
import DeptRoleUserPicker from '../../opd/components/DeptRoleUserPicker'

export default function Referrals({ admissionId }) {
    const [rows, setRows] = useState([])
    const [err, setErr] = useState('')
    const [toUser, setToUser] = useState(null)
    const [toDept, setToDept] = useState(null)
    const [f, setF] = useState({ type: 'internal', to_department: '', external_org: '', reason: '' })

    const load = async () => {
        setErr('')
        try { const { data } = await listReferrals(admissionId); setRows(data || []) }
        catch (e) { setErr(e?.response?.data?.detail || 'Failed to load referrals') }
    }
    useEffect(() => { load() }, [admissionId])

    const submit = async (e) => {
        e.preventDefault()
        try {
            const payload = {
                type: f.type,
                to_department: f.to_department || '',
                to_user_id: toUser || undefined,
                external_org: f.external_org || '',
                reason: f.reason || '',
            }
            await addReferral(admissionId, payload)
            setF({ type: 'internal', to_department: '', external_org: '', reason: '' })
            setToUser(null); setToDept(null)
            await load()
        } catch (e1) {
            setErr(e1?.response?.data?.detail || 'Failed to create referral')
        }
    }

    return (
        <div className="space-y-3">
            <form onSubmit={submit} className="rounded-xl border bg-white p-3 text-sm space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                    <div>
                        <label className="text-xs text-gray-500">Type</label>
                        <select className="input" value={f.type} onChange={e => setF(s => ({ ...s, type: e.target.value }))}>
                            <option value="internal">Internal</option>
                            <option value="external">External</option>
                        </select>
                    </div>

                    {f.type === 'internal' ? (
                        <div className="md:col-span-2">
                            <DeptRoleUserPicker
                                label="Department · Role · User"
                                value={toUser || undefined}
                                onChange={(userId, ctx) => {
                                    setToUser(userId || null)
                                    setToDept(ctx?.department_id || null)
                                    setF(s => ({ ...s, to_department: ctx?.department_id ? String(ctx.department_id) : '' }))
                                }}
                            />
                        </div>
                    ) : (
                        <input className="input md:col-span-2" placeholder="External organization" value={f.external_org} onChange={e => setF(s => ({ ...s, external_org: e.target.value }))} />
                    )}
                </div>

                <input className="input" placeholder="Reason" value={f.reason} onChange={e => setF(s => ({ ...s, reason: e.target.value }))} />
                <div className="flex justify-end"><button className="btn">Save</button></div>
                {err && <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 text-sm">{err}</div>}
            </form>

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">To</th>
                            <th className="px-3 py-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(rows || []).map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">{r.type}</td>
                                <td className="px-3 py-2">{r.type === 'internal' ? (r.to_user_id ? `User#${r.to_user_id}` : `Dept ${r.to_department}`) : (r.external_org || '—')}</td>
                                <td className="px-3 py-2">{r.status}</td>
                            </tr>
                        ))}
                        {!rows?.length && <tr><td className="p-3 text-sm text-gray-500" colSpan={3}>No referrals</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
