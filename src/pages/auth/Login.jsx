import { useMemo, useState } from 'react'
import { useAuth } from '../../store/authStore'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Info,
} from 'lucide-react'

const cx = (...a) => a.filter(Boolean).join(' ')

export default function Login() {
  const loc = useLocation()
  const nav = useNavigate()

  const login = useAuth((s) => s.login)
  const fetchProfile = useAuth((s) => s.fetchProfile)

  const [form, setForm] = useState({
    tenant_code:
      loc.state?.tenant_code ||
      localStorage.getItem('tenant_code') ||
      localStorage.getItem('pending_tenant_code') ||
      '',
    login_id:
      loc.state?.login_id ||
      localStorage.getItem('pending_login_id') ||
      '',
    password: '',
  })

  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const canSubmit = useMemo(() => {
    const tc = form.tenant_code.trim()
    const lid = String(form.login_id || '').trim()
    const pw = form.password.trim()
    return tc && lid.length === 6 && pw && !loading
  }, [form, loading])

  const goAfterAuth = async () => {
    await fetchProfile()
    const u = useAuth.getState().user
    if (u?.is_admin) nav('/admin', { replace: true })
    else nav('/dashboard', { replace: true })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setErr('')
    setLoading(true)

    try {
      const tenant_code = form.tenant_code.trim().toUpperCase()
      const login_id = String(form.login_id || '').replace(/\D/g, '').slice(0, 6)

      const data = await login({
        tenant_code,
        login_id,
        password: form.password,
      })

      // Persist pending values (useful for OTP step or refresh)
      localStorage.setItem('pending_tenant_code', tenant_code)
      localStorage.setItem('pending_login_id', login_id)

      // ✅ NEW CONTRACT: otp_required + purpose
      if (data?.otp_required) {
        const purpose = data?.purpose || 'login'
        localStorage.setItem('pending_otp_purpose', purpose)

        if (data?.masked_email) localStorage.setItem('pending_masked_email', data.masked_email)

        nav('/auth/verify', {
          state: {
            tenant_code,
            login_id,
            purpose,
            masked_email: data?.masked_email || '',
          },
          replace: true,
        })
        return
      }

      // 2FA disabled -> tokens returned -> go inside
      if (data?.access_token) {
        await goAfterAuth()
        return
      }

      setErr(data?.detail || data?.message || 'Login failed. Please try again.')
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        'Invalid credentials'

      setErr(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white">
      {/* premium background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 -top-28 h-72 w-72 rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute -right-28 -bottom-28 h-80 w-80 rounded-full bg-indigo-100 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,_#0f172a_1px,_transparent_0)] [background-size:22px_22px]" />
      </div>

      <div className="relative z-10 grid min-h-screen place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rotate-45 bg-gradient-to-br from-blue-50 to-indigo-50" />

            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white ring-8 ring-slate-100">
                  <span className="text-[11px] font-semibold tracking-tight">
                    NDH
                  </span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                    NUTRYAH HIMS &amp; EMR
                  </h1>
                  <p className="text-xs text-slate-500">
                    Login with Hospital Code + 6-digit Login ID
                  </p>
                </div>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>

            <form onSubmit={submit} className="space-y-4" aria-busy={loading}>
              {/* Hospital Code */}
              <label className="block">
                <span className="mb-1 block text-sm text-slate-700">
                  Hospital Code
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-200">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <input
                    className="w-full bg-transparent outline-none placeholder:text-slate-400 uppercase"
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
                <p className="mt-1 text-[11px] text-slate-500">
                  Tenant / Hospital code assigned by NUTRYAH.
                </p>
              </label>

              {/* Login ID */}
              <label className="block">
                <span className="mb-1 block text-sm text-slate-700">
                  Login ID
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-200">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  <input
                    className="w-full bg-transparent outline-none placeholder:text-slate-400 tabular-nums tracking-[0.18em]"
                    placeholder="000123"
                    inputMode="numeric"
                    value={form.login_id}
                    onChange={(e) => {
                      const v = (e.target.value || '').replace(/\D/g, '').slice(0, 6)
                      setForm((f) => ({ ...f, login_id: v }))
                    }}
                    required
                    disabled={loading}
                    aria-label="6-digit Login ID"
                  />
                  <span className="text-[11px] text-slate-400">
                    {String(form.login_id || '').length}/6
                  </span>
                </div>
              </label>

              {/* Password */}
              <label className="block">
                <span className="mb-1 block text-sm text-slate-700">
                  Password
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-200">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <input
                    className="w-full bg-transparent outline-none placeholder:text-slate-400"
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
                    className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-50"
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
                className={cx(
                  'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-white shadow-sm transition active:scale-[0.99]',
                  'bg-gradient-to-r from-slate-900 to-slate-800',
                  'disabled:cursor-not-allowed disabled:opacity-60'
                )}
                disabled={!canSubmit}
                type="submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>Continue</>
                )}
              </button>

              {/* Error */}
              {err && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {err}
                </div>
              )}

              {/* Tip */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    If your account has <span className="font-semibold">2FA enabled</span>, we’ll send an OTP to your registered email.
                    If <span className="font-semibold">Multi-Login</span> is disabled, only one device session is allowed.
                  </div>
                </div>
              </div>
            </form>

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 grid place-items-center rounded-3xl bg-white/70 backdrop-blur-sm">
                <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                  <div className="mb-2 flex items-center gap-2 text-sm text-slate-700">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-900" />
                    Signing in…
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="absolute inset-y-0 left-0 w-1/3 animate-[progress_1.2s_infinite] rounded-full bg-gradient-to-r from-slate-800 to-slate-600" />
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-700 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-700 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-700" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mx-auto mt-6 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} NUTRYAH — Secure Tenant Access
          </div>
        </div>
      </div>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}
