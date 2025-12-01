// frontend/src/opd/components/DeptRoleUserPicker.jsx
import { useEffect, useState } from 'react'
import {
    fetchDepartments,
    fetchDepartmentRoles,
    fetchDepartmentUsers,
} from '../../api/opd'

export default function DeptRoleUserPicker({
    value,
    onChange,
    label = 'Department · Role · User',
    onlyDoctors = false,
}) {
    const [depts, setDepts] = useState([])
    const [deptId, setDeptId] = useState('')
    const [roles, setRoles] = useState([])
    const [roleId, setRoleId] = useState('')
    const [users, setUsers] = useState([])
    const [userId, setUserId] = useState('')

    useEffect(() => {
        let alive = true
        fetchDepartments()
            .then((r) => alive && setDepts(r.data || []))
            .catch(() => alive && setDepts([]))
        return () => {
            alive = false
        }
    }, [])

    useEffect(() => {
        let alive = true
        setRoleId('')
        setUsers([])
        setUserId('')
        if (!deptId) {
            setRoles([])
            return
        }
        fetchDepartmentRoles({ departmentId: Number(deptId) })
            .then((r) => alive && setRoles(r.data || []))
            .catch(() => alive && setRoles([]))
        return () => {
            alive = false
        }
    }, [deptId])

    useEffect(() => {
        let alive = true
        setUsers([])
        setUserId('')
        if (!deptId || !roleId) return
        fetchDepartmentUsers({
            departmentId: Number(deptId),
            roleId: Number(roleId),
            isDoctor: onlyDoctors,
        })
            .then((r) => alive && setUsers(r.data || []))
            .catch(() => alive && setUsers([]))
        return () => {
            alive = false
        }
    }, [deptId, roleId, onlyDoctors])

    useEffect(() => {
        onChange?.(
            userId ? Number(userId) : null,
            {
                department_id: deptId ? Number(deptId) : null,
                role_id: roleId ? Number(roleId) : null,
            },
        )
    }, [userId, deptId, roleId, onChange])

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>
            <div className="grid gap-3 sm:grid-cols-3">
                <select
                    className="input"
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                >
                    <option value="">Select department</option>
                    {depts.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </select>

                <select
                    className="input"
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    disabled={!deptId}
                >
                    <option value="">Select role</option>
                    {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                            {r.name}
                        </option>
                    ))}
                </select>

                <select
                    className="input"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    disabled={!roleId}
                >
                    <option value="">Select user</option>
                    {users.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}
