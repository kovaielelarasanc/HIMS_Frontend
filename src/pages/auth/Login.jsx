// frontend/src/pages/auth/Login.jsx
import { useState, useMemo } from 'react'
import { useAuth } from '../../store/authStore'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Building2,
} from 'lucide-react'

export default function Login() {
  const loc = useLocation()
  const nav = useNavigate()
  const login = useAuth((s) => s.login)

  const [form, setForm] = useState({
    tenant_code:
      loc.state?.tenant_code ||
      localStorage.getItem('tenant_code') ||
      localStorage.getItem('pending_tenant_code') ||
      '',
    email: loc.state?.email || localStorage.getItem('pending_email') || '',
    password: '',
  })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const canSubmit = useMemo(
    () =>
      form.tenant_code.trim() &&
      form.email.trim() &&
      form.password.trim() &&
      !loading,
    [form, loading]
  )

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setErr('')
    setLoading(true)
    try {
      await login({
        tenant_code: form.tenant_code.trim(),
        email: form.email.trim(),
        password: form.password,
      })

      // Save pending for OTP step
      localStorage.setItem('pending_email', form.email.trim())
      localStorage.setItem('pending_tenant_code', form.tenant_code.trim())

      nav('/auth/verify', {
        state: {
          email: form.email.trim(),
          tenant_code: form.tenant_code.trim(),
        },
      })
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-gray-50 to-white">
      {/* animated background blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-100 blur-3xl animate-pulse" />
        <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-100 blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 grid min-h-screen place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white/80 p-6 shadow-sm backdrop-blur">
            {/* Corner ribbon */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rotate-45 bg-gradient-to-br from-blue-50 to-indigo-50" />
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white ring-8 ring-blue-50">
                  <span className="text-sm font-bold tracking-tight">
                    NDH
                  </span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight">
                    NUTRYAH&apos;s HIMS &amp; EMR
                  </h1>
                  <p className="text-xs text-gray-500">
                    Multi-tenant login with Hospital Code + Email + OTP
                  </p>
                </div>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>

            <form onSubmit={submit} className="space-y-4" aria-busy={loading}>
              {/* Tenant / Hospital Code */}
              <label className="block">
                <span className="mb-1 block text-sm text-gray-600">
                  Hospital Code
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-200">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <input
                    className="w-full bg-transparent outline-none placeholder:text-gray-400 uppercase"
                    placeholder="KGH001"
                    value={form.tenant_code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tenant_code: e.target.value.toUpperCase(),
                      }))
                    }
                    required
                    disabled={loading}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  Hospital / Clinic code assigned by NUTRYAH (Tenant Code).
                </p>
              </label>

              {/* Email */}
              <label className="block">
                <span className="mb-1 block text-sm text-gray-600">
                  Email
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-200">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <input
                    className="w-full bg-transparent outline-none placeholder:text-gray-400"
                    placeholder="you@hospital.org"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    required
                    disabled={loading}
                  />
                </div>
              </label>

              {/* Password */}
              <label className="block">
                <span className="mb-1 block text-sm text-gray-600">
                  Password
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-200">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    className="w-full bg-transparent outline-none placeholder:text-gray-400"
                    placeholder="••••••••"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-50"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                    disabled={loading}
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              {/* Submit */}
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSubmit}
                type="submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Sending OTP…</span>
                  </>
                ) : (
                  <>Send OTP</>
                )}
              </button>

              {/* Error */}
              {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {err}
                </div>
              )}

              {/* Tiny help */}
              <p className="text-center text-xs text-gray-500">
                Tip: You&apos;ll receive a 6-digit OTP in your email. Keep this
                tab open.
              </p>
            </form>

            {/* Loading overlay (animated) */}
            {loading && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-sm">
                <div className="w-full max-w-xs rounded-xl border border-gray-100 bg-white p-4 shadow-md">
                  <div className="mb-2 flex items-center gap-2 text-sm text-gray-700">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    Sending OTP…
                  </div>

                  {/* Indeterminate bar */}
                  <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="absolute inset-y-0 left-0 w-1/3 animate-[progress_1.2s_infinite] rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                  </div>

                  {/* Bouncing dots */}
                  <div className="mt-3 flex items-center justify-center gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer brand strip */}
          <div className="mx-auto mt-6 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} NUTRYAH — Multi-tenant Secure Access
          </div>
        </div>
      </div>

      {/* keyframes for the indeterminate bar */}
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}
