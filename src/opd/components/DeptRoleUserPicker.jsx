// FILE: src/opd/components/DeptRoleUserPicker.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { listOpdDepartments, listOpdUsers } from '../../api/opd'

/**
 * Props:
 *  - label?: string
 *  - value?: number | string  -> practitioner_user_id
 *  - onChange?: (userId: number | null, ctx?: { department_id?: number | null, user?: any }) => void
 */
export default function DeptRoleUserPicker({
    label = 'Department · Doctor',
    value,
    onChange,
}) {
    const [departments, setDepartments] = useState([])
    const [doctors, setDoctors] = useState([])

    const [departmentId, setDepartmentId] = useState(null)
    const [selectedUserId, setSelectedUserId] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // ---------- 1. Load departments on mount ----------
    useEffect(() => {
        let alive = true
            ; (async () => {
                setLoading(true)
                setError('')
                try {
                    const { data } = await listOpdDepartments()
                    if (!alive) return
                    setDepartments(data || [])
                } catch (e) {
                    if (!alive) return
                    setError(
                        e?.response?.data?.detail ||
                        'Failed to load departments'
                    )
                } finally {
                    alive && setLoading(false)
                }
            })()
        return () => {
            alive = false
        }
    }, [])

    // ---------- 2. Load doctors when department changes ----------
    useEffect(() => {
        if (!departmentId) {
            setDoctors([])
            return
        }
        let alive = true
            ; (async () => {
                setLoading(true)
                setError('')
                try {
                    const { data } = await listOpdUsers({
                        departmentId,
                        isDoctor: true,
                    })
                    if (!alive) return
                    setDoctors(data || [])
                } catch (e) {
                    if (!alive) return
                    setError(e?.response?.data?.detail || 'Failed to load doctors')
                } finally {
                    alive && setLoading(false)
                }
            })()
        return () => {
            alive = false
        }
    }, [departmentId])

    // ---------- 3. Sync `value` from parent into local state (NO onChange here) ----------
    useEffect(() => {
        if (value == null || value === '') {
            // parent cleared selection
            setSelectedUserId(null)
            return
        }
        const numVal = Number(value)
        if (!Number.isFinite(numVal)) return

        // avoid useless setState => no extra renders
        setSelectedUserId((prev) => (prev === numVal ? prev : numVal))
    }, [value])

    const currentDoctor = useMemo(
        () => doctors.find((d) => d.id === selectedUserId) || null,
        [doctors, selectedUserId]
    )

    const handleDeptChange = useCallback((e) => {
        const v = e.target.value
        const nextDeptId = v ? Number(v) : null

        setDepartmentId(nextDeptId)
        // whenever department changes, clear doctor locally + notify parent with null
        setSelectedUserId(null)
        if (onChange) {
            onChange(null, { department_id: nextDeptId })
        }
    }, [onChange])

    const handleDoctorChange = useCallback(
        (e) => {
            const v = e.target.value
            const nextUserId = v ? Number(v) : null

            setSelectedUserId(nextUserId)

            if (onChange) {
                const ctx = {
                    department_id: departmentId,
                    user: doctors.find((d) => d.id === nextUserId) || null,
                }
                onChange(nextUserId, ctx)
            }
        },
        [onChange, departmentId, doctors]
    )

    return (
        <div className="space-y-1 text-sm">
            {label && (
                <label className="block text-xs font-medium text-gray-600">
                    {label}
                </label>
            )}

            <div className="grid gap-2 md:grid-cols-2">
                {/* Department select */}
                <select
                    className="input"
                    value={departmentId ?? ''}
                    onChange={handleDeptChange}
                >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </select>

                {/* Doctor select */}
                <select
                    className="input"
                    value={selectedUserId ?? ''}
                    onChange={handleDoctorChange}
                    disabled={!departmentId || loading}
                >
                    <option value="">
                        {departmentId
                            ? loading
                                ? 'Loading doctors…'
                                : 'Select doctor'
                            : 'Select department first'}
                    </option>
                    {doctors.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.full_name || u.name || `User #${u.id}`}
                        </option>
                    ))}
                </select>
            </div>

            {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                    {error}
                </div>
            )}
        </div>
    )
}
