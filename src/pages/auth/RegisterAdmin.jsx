// frontend/src/pages/auth/RegisterAdmin.jsx
import { useState } from 'react'
import { useAuth } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { Building2, Loader2, ShieldPlus, Info } from 'lucide-react'

export default function RegisterAdmin() {
    const [form, setForm] = useState({
        tenant_name: '',
        tenant_code: '',
        hospital_address: '',
        contact_person: '',
        contact_phone: '',
        subscription_plan: 'standard', // basic / standard / premium
        admin_name: '',
        email: '',
        password: '',
        confirm_password: '',
    })
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')

    const registerAdmin = useAuth((s) => s.registerAdmin)
    const nav = useNavigate()

    const onChange = (field) => (e) =>
        setForm((f) => ({ ...f, [field]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault()
        if (loading) return
        setErr('')

        if (form.password !== form.confirm_password) {
            setErr('Passwords do not match')
            return
        }

        setLoading(true)
        try {
            const res = await registerAdmin(form)
            const { tenant_code } = res.data || {}

            alert(
                `Hospital onboarded successfully.\nTenant Code: ${tenant_code || form.tenant_code || 'Generated'
                }\n\nPlease login with Hospital Code + Admin email.`,
            )

            nav('/auth/login', {
                replace: true,
                state: {
                    email: form.email,
                    tenant_code: tenant_code || form.tenant_code,
                },
            })
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to register tenant admin')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-white">
            {/* subtle bg blobs */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-100 blur-3xl" />
                <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-100 blur-3xl" />
            </div>

            <div className="relative z-10 grid min-h-screen place-items-center px-4 py-8">
                <div className="w-full max-w-2xl">
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white ring-8 ring-blue-50">
                            <span className="text-sm font-bold tracking-tight">NDH</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">
                                Onboard a New Hospital / Clinic
                            </h1>
                            <p className="text-xs text-slate-500">
                                This will create a dedicated NABH HIMS &amp; EMR tenant with its
                                own database.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={submit}
                        className="space-y-5 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur"
                    >
                        {/* Hospital details */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm text-slate-700">
                                    Hospital / Clinic Name
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-200">
                                    <Building2 className="h-4 w-4 text-slate-400" />
                                    <input
                                        className="w-full bg-transparent outline-none placeholder:text-slate-400"
                                        placeholder="Kovai Multispeciality Hospital"
                                        value={form.tenant_name}
                                        onChange={onChange('tenant_name')}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm text-slate-700">
                                    Hospital Code (Tenant Code)
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
                                    placeholder="KGH001"
                                    value={form.tenant_code}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            tenant_code: e.target.value.toUpperCase(),
                                        }))
                                    }
                                />
                                <p className="mt-1 text-[11px] text-slate-500">
                                    Optional. If empty, the system will generate a code from the
                                    name.
                                </p>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm text-slate-700">
                                    Contact Person
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
                                    placeholder="Dr. Admin / IT Head"
                                    value={form.contact_person}
                                    onChange={onChange('contact_person')}
                                    required
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm text-slate-700">
                                    Contact Phone
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
                                    placeholder="+91 9XXXXXXXXX"
                                    value={form.contact_phone}
                                    onChange={onChange('contact_phone')}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm text-slate-700">
                                    Hospital Address
                                </label>
                                <textarea
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
                                    placeholder="Address, City, State, Pincode"
                                    rows={2}
                                    value={form.hospital_address}
                                    onChange={onChange('hospital_address')}
                                />
                            </div>
                        </div>

                        {/* Subscription (plan only – commercial from NDH admin) */}
                        <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-800">
                                <Info className="h-4 w-4 text-blue-600" />
                                Subscription & License Period
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm text-slate-700">
                                        Subscription Plan
                                    </label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                        value={form.subscription_plan}
                                        onChange={onChange('subscription_plan')}
                                    >
                                        <option value="basic">Basic (Monthly)</option>
                                        <option value="standard">Standard (6 Months)</option>
                                        <option value="premium">Premium (1 Year)</option>
                                    </select>
                                </div>

                                <div className="text-xs text-slate-600 space-y-1">
                                    <p className="font-medium text-slate-700">
                                        License Duration (auto-calculated):
                                    </p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        <li>Basic → 30 days from registration</li>
                                        <li>Standard → 6 months from registration</li>
                                        <li>Premium → 1 year from registration</li>
                                    </ul>
                                    <p className="pt-1 text-[11px] text-slate-500">
                                        AMC, subscription amount, and renewals are configured by
                                        NUTRYAH admin in the master console. They are not editable
                                        from this screen.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Admin login details */}
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
                                <ShieldPlus className="h-4 w-4 text-blue-600" />
                                Admin Login for this Tenant
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs text-slate-600">
                                        Admin Name
                                    </label>
                                    <input
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
                                        placeholder="Super Admin"
                                        value={form.admin_name}
                                        onChange={onChange('admin_name')}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-slate-600">
                                        Admin Email
                                    </label>
                                    <input
                                        type="email"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
                                        placeholder="admin@hospital.org"
                                        value={form.email}
                                        onChange={onChange('email')}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-slate-600">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                        value={form.password}
                                        onChange={onChange('password')}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-slate-600">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                        value={form.confirm_password}
                                        onChange={onChange('confirm_password')}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Error */}
                        {err && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                {err}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creating Tenant…
                                </>
                            ) : (
                                'Create Tenant & Admin'
                            )}
                        </button>

                        <p className="text-center text-[11px] text-slate-500">
                            After this step, use the Hospital Code + Admin Email to login and
                            access the dedicated HIMS database.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    )
}
