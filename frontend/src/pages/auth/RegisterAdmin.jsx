import { useState, useEffect } from 'react'
import { useAuth } from '../../store/authStore'
import API from '../../api/client'
import { useNavigate } from 'react-router-dom'


export default function RegisterAdmin() {
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm_password: '' })
    const registerAdmin = useAuth(s => s.registerAdmin)
    const nav = useNavigate()
    const [blocked, setBlocked] = useState(false)


    useEffect(() => {
        API.get('/admin/status').then(r => setBlocked(r.data.admin_exists))
    }, [])


    const submit = async (e) => {
        e.preventDefault()
        if (blocked) return
        await registerAdmin(form)
        alert('Admin registered. Please login.')
        nav('/auth/login')
    }


    if (blocked) {
        return <div className="min-h-screen grid place-items-center"><div className="card max-w-md"><h2 className="text-2xl font-semibold mb-2">Admin already exists</h2><p>Registration is disabled.</p></div></div>
    }


    return (
        <div className="min-h-screen grid place-items-center p-6">
            <form onSubmit={submit} className="card w-full max-w-md space-y-4">
                <h1 className="text-2xl font-semibold">Create Admin</h1>
                <input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                <input className="input" placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                <input className="input" placeholder="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                <input className="input" placeholder="Confirm Password" type="password" value={form.confirm_password} onChange={e => setForm({ ...form, confirm_password: e.target.value })} required />
                <button className="btn w-full">Register</button>
            </form>
        </div>
    )
}