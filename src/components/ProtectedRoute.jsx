// frontend/src/components/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../store/authStore'

export default function ProtectedRoute() {
    const { user, loading, fetchProfile } = useAuth()
    const [boot, setBoot] = useState(false)
    const token = localStorage.getItem('access_token')
    const loc = useLocation()

    useEffect(() => {
        if (token && !user && !loading) {
            setBoot(true)
            fetchProfile().finally(() => setBoot(false))
        }
    }, [token, user, loading, fetchProfile])

    if (!token) return <Navigate to="/auth/login" state={{ from: loc }} replace />

    if (boot || loading || (!user && token)) {
        return <div className="min-h-screen grid place-items-center text-sm">Loading…</div>
    }

    return <Outlet />
}
