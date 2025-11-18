// frontend/src/opd/components/DoctorPicker.jsx
import { useEffect, useMemo, useState } from 'react'
import { fetchDepartments, fetchRolesByDepartment, fetchDepartmentUsers } from '../../api/opd'

export default function DoctorPicker({ value, onChange }) {
    const [depts, setDepts] = useState([])
    const [deptId, setDeptId] = useState('')
    const [roles, setRoles] = useState([])
    const [roleId, setRoleId] = useState('')
    const [users, setUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [loadingRoles, setLoadingRoles] = useState(false)
    const [err, setErr] = useState('')

    // load departments once
    useEffect(() => {
        let alive = true
        fetchDepartments()
            .then(r => alive && setDepts(r.data || []))
            .catch(() => alive && setDepts([]))
        return () => { alive = false }
    }, [])

    // load roles when department changes
    useEffect(() => {
        let alive = true
        setErr('')
        setRoles([])
        setRoleId('')
        setUsers([])
        onChange?.(null)

        if (!deptId) return
        setLoadingRoles(true)
        fetchRolesByDepartment(deptId)
            .then(r => { if (alive) setRoles(r.data || []) })
            .catch(e => { if (alive) setErr(e?.response?.data?.detail || 'Failed to load roles') })
            .finally(() => { if (alive) setLoadingRoles(false) })

        return () => { alive = false }
    }, [deptId])

    // load users when department or role changes
    useEffect(() => {
        let alive = true
        setErr('')
        setUsers([])
        onChange?.(null)
        if (!deptId) return

        setLoadingUsers(true)
        fetchDepartmentUsers(deptId, roleId || undefined)
            .then(r => { if (alive) setUsers(r.data || []) })
            .catch(e => { if (alive) setErr(e?.response?.data?.detail || 'Failed to load users') })
            .finally(() => { if (alive) setLoadingUsers(false) })

        return () => { alive = false }
    }, [deptId, roleId])

    const selected = useMemo(() => users.find(u => u.id === value) || null, [users, value])

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Department ➜ Role ➜ User</label>

            <div className="grid gap-3 md:grid-cols-3">
                {/* Department */}
                <select
                    className="input"
                    value={deptId}
                    onChange={e => setDeptId(e.target.value)}
                >
                    <option value="">Select department</option>
                    {depts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>

                {/* Role (from backend; optional) */}
                <select
                    className="input"
                    value={roleId}
                    onChange={e => setRoleId(e.target.value)}
                    disabled={!deptId || loadingRoles}
                >
                    <option value="">All roles</option>
                    {roles.map(r => (
                        <option key={r.id} value={r.id}>
                            {r.name}{typeof r.members === 'number' ? ` (${r.members})` : ''}
                        </option>
                    ))}
                </select>

                {/* User list (dept + optional role_id) */}
                <select
                    className="input"
                    value={value || ''}
                    onChange={e => onChange(Number(e.target.value))}
                    disabled={!deptId || loadingUsers || users.length === 0}
                >
                    <option value="">{loadingUsers ? 'Loading users…' : 'Select user'}</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>
                            {u.name}{u.roles?.length ? ` • ${u.roles.join(', ')}` : ''}
                        </option>
                    ))}
                </select>
            </div>

            {selected && (
                <div className="rounded-xl border bg-emerald-50 px-3 py-2 text-sm">
                    Selected: <span className="font-medium">{selected.name}</span>
                </div>
            )}

            {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {err}
                </div>
            )}
        </div>
    )
}
