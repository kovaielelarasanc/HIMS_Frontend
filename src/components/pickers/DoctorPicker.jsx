// FILE: frontend/src/components/pickers/DoctorPicker.jsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { fetchDepartments, fetchDepartmentUsers } from '../../api/opd'

/**
 * Reusable Doctor picker:
 *
 * Props:
 *   value:        doctor_user_id (number | null)
 *   onChange:     (doctorId: number | null, meta: { department_id: number | null }) => void
 *   label:        section label (string)
 *   initialDepartmentId: number | null   // for edit mode (pre-selected dept)
 *   disabled:     boolean
 */
export default function DoctorPicker({
    value,
    onChange,
    label = 'Department ➜ Doctor',
    initialDepartmentId = null,
    disabled = false,
}) {
    const [depts, setDepts] = useState([])
    const [deptId, setDeptId] = useState('') // string for <select>
    const [users, setUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [loadingDepts, setLoadingDepts] = useState(false)
    const [err, setErr] = useState('')

    // ---- Load departments once ----
    useEffect(() => {
        let alive = true
        setLoadingDepts(true)
        fetchDepartments()
            .then((r) => {
                if (!alive) return
                setDepts(r.data || [])
            })
            .catch((e) => {
                if (!alive) return
                console.error('fetchDepartments error', e)
                toast.error('Failed to load departments')
                setDepts([])
            })
            .finally(() => {
                if (!alive) return
                setLoadingDepts(false)
            })
        return () => {
            alive = false
        }
    }, [])

    // ---- Set initial dept in edit mode (once) ----
    useEffect(() => {
        if (initialDepartmentId && !deptId) {
            setDeptId(String(initialDepartmentId))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialDepartmentId])

    // ---- When department changes: load doctors ONLY ----
    useEffect(() => {
        let alive = true
        setErr('')
        setUsers([])

        if (!deptId) return

        const deptNum = Number(deptId)
        setLoadingUsers(true)
        fetchDepartmentUsers({
            departmentId: deptNum,
            isDoctor: true, // ONLY doctors
        })
            .then((r) => {
                if (!alive) return
                setUsers(r.data || [])
            })
            .catch((e) => {
                if (!alive) return
                console.error('fetchDepartmentUsers error', e)
                const msg =
                    e?.response?.data?.detail || 'Failed to load doctors'
                setErr(msg)
                toast.error(msg)
                setUsers([])
            })
            .finally(() => {
                if (!alive) return
                setLoadingUsers(false)
            })

        return () => {
            alive = false
        }
    }, [deptId])

    const selectedDoctor = useMemo(
        () => users.find((u) => u.id === value) || null,
        [users, value],
    )

    const handleDeptChange = (e) => {
        const newDeptId = e.target.value
        setDeptId(newDeptId)

        const deptNum = newDeptId ? Number(newDeptId) : null
        // 🔥 Inform parent that doctor is cleared when dept changes
        onChange?.(null, { department_id: deptNum })
    }

    const handleDoctorChange = (e) => {
        const id = e.target.value
        const numId = id ? Number(id) : null
        const deptNum = deptId ? Number(deptId) : null
        onChange?.(numId, { department_id: deptNum })
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>

            <div className="grid gap-3 md:grid-cols-2">
                {/* Department */}
                <select
                    className="input"
                    value={deptId}
                    onChange={handleDeptChange}
                    disabled={loadingDepts || disabled}
                >
                    <option value="">
                        {loadingDepts ? 'Loading departments…' : 'Select department'}
                    </option>
                    {depts.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </select>

                {/* Doctor list (filtered by dept + is_doctor=true) */}
                <select
                    className="input"
                    value={value || ''}
                    onChange={handleDoctorChange}
                    disabled={
                        disabled || !deptId || loadingUsers || users.length === 0
                    }
                >
                    <option value="">
                        {loadingUsers
                            ? 'Loading doctors…'
                            : !deptId
                                ? 'Select department first'
                                : users.length === 0
                                    ? 'No doctors in this department'
                                    : 'Select doctor'}
                    </option>
                    {users.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name}
                            {u.email ? ` (${u.email})` : ''}
                        </option>
                    ))}
                </select>
            </div>

            {selectedDoctor && (
                <div className="rounded-xl border bg-emerald-50 px-3 py-2 text-sm">
                    Selected:{' '}
                    <span className="font-medium">{selectedDoctor.name}</span>
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
