import { useEffect, useState } from 'react'
import { fetchDepartments, fetchRolesByDepartment, fetchDepartmentUsers } from '../../api/opd'

export default function DeptRoleUserPicker({ value, onChange, label = 'Department · Role · User' }) {
    const [depts, setDepts] = useState([])
    const [deptId, setDeptId] = useState('')
    const [roles, setRoles] = useState([])
    const [roleId, setRoleId] = useState('')
    const [users, setUsers] = useState([])
    const [userId, setUserId] = useState('')

    useEffect(() => {
        fetchDepartments().then(r => setDepts(r.data || []))
    }, [])

    useEffect(() => {
        setRoleId('')
        setUsers([])
        setUserId('')
        if (!deptId) { setRoles([]); return }
        fetchRolesByDepartment(deptId).then(r => setRoles(r.data || []))
    }, [deptId])

    useEffect(() => {
        setUsers([])
        setUserId('')
        if (!deptId || !roleId) return
        fetchDepartmentUsers(deptId, roleId).then(r => setUsers(r.data || []))
    }, [deptId, roleId])

    useEffect(() => {
        onChange?.(userId ? Number(userId) : null, { department_id: deptId ? Number(deptId) : null })
    }, [userId])

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>
            <div className="grid gap-3 sm:grid-cols-3">
                <select className="input" value={deptId} onChange={e => setDeptId(e.target.value)}>
                    <option value="">Select department</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select className="input" value={roleId} onChange={e => setRoleId(e.target.value)} disabled={!deptId}>
                    <option value="">Select role</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select className="input" value={userId} onChange={e => setUserId(e.target.value)} disabled={!roleId}>
                    <option value="">Select user</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            </div>
        </div>
    )
}
