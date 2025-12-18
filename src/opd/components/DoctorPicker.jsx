// frontend/src/opd/components/DoctorPicker.jsx
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner'
import { fetchDepartments, fetchDepartmentUsers } from '../../api/opd'
import { Building2, Stethoscope, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Props:
 *   value: doctor_user_id (number | null)
 *   onChange: (doctorId: number | null, meta: {
 *      department_id: number | null,
 *      department_name?: string | null,
 *      doctor_name?: string | null,
 *      doctor_email?: string | null,
 *   }) => void
 *   label?: string
 */
export default function DoctorPicker({
    value,
    onChange,
    label = 'Primary Doctor — Department · Role · User',
}) {
    const [depts, setDepts] = useState([])
    const [deptId, setDeptId] = useState('') // string for <select>
    const [users, setUsers] = useState([])

    const [loadingDepts, setLoadingDepts] = useState(false)
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [err, setErr] = useState('')

    const deptObj = useMemo(
        () => (deptId ? depts.find((d) => Number(d.id) === Number(deptId)) : null),
        [depts, deptId]
    )

    // Load departments once
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
                const msg = e?.response?.data?.detail || 'Failed to load departments.'
                setDepts([])
                setErr(msg)
                toast.error(msg)
            })
            .finally(() => {
                if (!alive) return
                setLoadingDepts(false)
            })

        return () => { alive = false }
    }, [])

    // Whenever department changes:
    //  - clear selected doctor
    //  - inform parent about new dept
    //  - load doctors for that department
    useEffect(() => {
        let alive = true
        setErr('')
        setUsers([])

        const deptNum = deptId ? Number(deptId) : null
        const deptName = deptObj?.name || null

        // Tell parent: doctor cleared, dept changed (so parent can treat this as a filter)
        onChange?.(null, { department_id: deptNum, department_name: deptName })

        if (!deptId) return

        setLoadingUsers(true)
        fetchDepartmentUsers({
            departmentId: deptNum,
            isDoctor: true,
        })
            .then((r) => {
                if (!alive) return
                setUsers(r.data || [])
            })
            .catch((e) => {
                if (!alive) return
                console.error('fetchDepartmentUsers error', e)
                const msg = e?.response?.data?.detail || 'Failed to load doctors.'
                setErr(msg)
                setUsers([])
                toast.error(msg)
            })
            .finally(() => {
                if (!alive) return
                setLoadingUsers(false)
            })

        return () => { alive = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deptId])

    const selectedDoctor = useMemo(
        () => users.find((u) => Number(u.id) === Number(value)) || null,
        [users, value]
    )

    const handleDeptChange = (e) => {
        const newDeptId = e.target.value
        setDeptId(newDeptId)
        // doctor will be cleared + parent notified in useEffect above
    }

    const handleDoctorChange = (e) => {
        const id = e.target.value
        const numId = id ? Number(id) : null
        const deptNum = deptId ? Number(deptId) : null
        const deptName = deptObj?.name || null

        if (!numId) {
            onChange?.(null, { department_id: deptNum, department_name: deptName })
            return
        }

        const doc = users.find((u) => Number(u.id) === Number(numId)) || null
        onChange?.(numId, {
            department_id: deptNum,
            department_name: deptName,
            doctor_name: doc?.name || null,
            doctor_email: doc?.email || null,
        })
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Doctor & Department
                    </span>
                    <span className="text-sm font-medium text-slate-900">{label}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                    Choose department and doctor (or leave empty to show all).
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">Department</span>
                    </div>
                    <div className="relative">
                        {loadingDepts && (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                        )}
                        <select
                            className="input w-full rounded-2xl border border-slate-500 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            value={deptId}
                            onChange={handleDeptChange}
                            disabled={loadingDepts}
                        >
                            <option value="">
                                {loadingDepts ? 'Loading departments…' : 'All departments'}
                            </option>
                            {depts.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Stethoscope className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">Doctor</span>
                    </div>
                    <div className="relative">
                        {loadingUsers && (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                        )}
                        <select
                            className="input w-full rounded-2xl border border-slate-500 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            value={value || ''}
                            onChange={handleDoctorChange}
                            disabled={!deptId || loadingUsers || users.length === 0}
                        >
                            <option value="">
                                {loadingUsers
                                    ? 'Loading doctors…'
                                    : !deptId
                                        ? 'Select department first'
                                        : users.length === 0
                                            ? 'No doctors in this department'
                                            : 'All doctors (in this dept)'}
                            </option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}{u.email ? ` (${u.email})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {selectedDoctor && (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-semibold">Selected doctor:</span>
                    <span className="font-medium">{selectedDoctor.name}</span>
                    {selectedDoctor.email && <span className="text-emerald-700">· {selectedDoctor.email}</span>}
                </div>
            )}

            {err && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{err}</span>
                </div>
            )}
        </div>
    )
}
