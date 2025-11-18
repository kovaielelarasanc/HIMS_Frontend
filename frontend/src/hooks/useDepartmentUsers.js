// src/hooks/useDepartmentUsers.js
import { useEffect, useState } from 'react'
import API from '../api/client'

export default function useDepartmentUsers(departmentId, role) {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!departmentId) { setUsers([]); return }
        let active = true
        setLoading(true); setError('')
        API.get('/opd/users', { params: { department_id: departmentId, role } })
            .then(r => { if (active) setUsers(r.data) })
            .catch(e => {
                if (!active) return
                const s = e?.response?.status
                if (s === 403) setError('Not permitted to view staff in this department')
                else setError(e?.response?.data?.detail || 'Failed to load users')
                setUsers([])
            })
            .finally(() => active && setLoading(false))
        return () => { active = false }
    }, [departmentId, role])

    return { users, loading, error }
}
