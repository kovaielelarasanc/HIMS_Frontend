import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../store/authStore'
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Building2,
  KeyRound,
  Mail,
  RefreshCcw,
} from 'lucide-react'

export default function VerifyOtp() {
  const loc = useLocation()
  const nav = useNavigate()

  const verifyOtp = useAuth((s) => s.verifyOtp)
  const resendOtp = useAuth((s) => s.resendOtp)
  const fetchProfile = useAuth((s) => s.fetchProfile)

  const tenantCodeRaw =
    loc.state?.tenant_code ||
    localStorage.getItem('pending_tenant_code') ||
    localStorage.getItem('tenant_code') ||
    ''

  const loginIdRaw =
    loc.state?.login_id ||
    localStorage.getItem('pending_login_id') ||
    ''

  const tenantCode = useMemo(() => String(tenantCodeRaw || '').trim().toUpperCase(), [tenantCodeRaw])
  const loginId = useMemo(() => String(loginIdRaw || '').trim(), [loginIdRaw])

  const [maskedEmail, setMaskedEmail] = useState(
    loc.state?.masked_email || localStorage.getItem('pending_masked_email') || ''
  )

  // ✅ purpose must match the OTP that was issued: "login" or "email_verify"
  const [purpose, setPurpose] = useState(
    loc.state?.purpose ||
    loc.state?.otp_purpose ||
    localStorage.getItem('pending_otp_purpose') ||
    'login'
  )

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [seconds, setSeconds] = useState(60)
  const [success, setSuccess] = useState(false)
  const [resending, setResending] = useState(false)

  const inputsRef = useRef([])

  useEffect(() => {
    if (!tenantCode || !loginId) {
      nav('/auth/login', { replace: true })
      return
    }
    // focus first input on mount
    setTimeout(() => inputsRef.current[0]?.focus(), 0)
  }, [tenantCode, loginId, nav])

  useEffect(() => {
    // persist in case refresh happens on OTP page
    localStorage.setItem('pending_tenant_code', tenantCode)
    localStorage.setItem('pending_login_id', String(loginId || ''))
    localStorage.setItem('pending_otp_purpose', (purpose || 'login').trim())
    if (maskedEmail) localStorage.setItem('pending_masked_email', maskedEmail)
  }, [tenantCode, loginId, purpose, maskedEmail])

  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [seconds])

  const code = useMemo(() => digits.join(''), [digits])
  const canSubmit = code.length === 6 && !digits.includes('') && !loading

  const setDigit = (index, val) => {
    const v = (val || '').replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = v
      return next
    })
    if (v && index < 5) inputsRef.current[index + 1]?.focus()
  }

  const onKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        setDigits((prev) => {
          const next = [...prev]
          next[index] = ''
          return next
        })
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus()
        setDigits((prev) => {
          const next = [...prev]
          next[index - 1] = ''
          return next
        })
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1]?.focus()
    } else if (e.key === 'Enter') {
      // allow Enter to submit
      if (canSubmit) {
        e.preventDefault()
        submit(e)
      }
    }
  }

  const onPaste = (e) => {
    e.preventDefault()
    const text = (e.clipboardData.getData('text') || '')
      .replace(/\D/g, '')
      .slice(0, 6)
    if (!text) return
    const arr = text.split('')
    setDigits([arr[0] || '', arr[1] || '', arr[2] || '', arr[3] || '', arr[4] || '', arr[5] || ''])
    inputsRef.current[Math.min(text.length, 5)]?.focus()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setErr('')
    setLoading(true)

    try {
      // ✅ CRITICAL FIX:
      // authStore.verifyOtp expects { otp }, not { otp_code }
      await verifyOtp({
        tenant_code: tenantCode,
        login_id: loginId,
        otp: code,          // ✅ REQUIRED
        otp_code: code,     // ✅ extra safety (ignored if store doesn’t use it)
        purpose: (purpose || 'login').trim(),
      })

      await fetchProfile()
      setSuccess(true)

      // cleanup pending state
      localStorage.removeItem('pending_tenant_code')
      localStorage.removeItem('pending_login_id')
      localStorage.removeItem('pending_masked_email')
      localStorage.removeItem('pending_otp_purpose')

      setTimeout(() => {
        const user = useAuth.getState().user
        if (user?.is_admin) nav('/admin', { replace: true })
        else nav('/dashboard', { replace: true })
      }, 350)
    } catch (e2) {
      setErr(e2?.response?.data?.detail || 'Invalid or expired OTP')
    } finally {
      setLoading(false)
    }
  }

  const goBackToLogin = () => {
    nav('/auth/login', {
      state: { tenant_code: tenantCode, login_id: loginId },
      replace: true,
    })
  }

  const resend = async () => {
    setErr('')
    setResending(true)
    try {
      const data = await resendOtp({
        tenant_code: tenantCode,
        login_id: loginId,
        purpose: (purpose || 'login').trim(),
      })

      if (data?.masked_email) {
        setMaskedEmail(data.masked_email)
        localStorage.setItem('pending_masked_email', data.masked_email)
      }

      setSeconds(60)
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => inputsRef.current[0]?.focus(), 0)
    } catch (e2) {
      setErr(e2?.response?.data?.detail || 'Failed to resend OTP')
    } finally {
      setResending(false)
    }
  }

  const title = purpose === 'email_verify' ? 'Verify Email OTP' : 'Verify OTP'
  const subtitle =
    purpose === 'email_verify'
      ? 'Enter the 6-digit code to verify your email and continue'
      : 'Enter the 6-digit code to continue'

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 -top-28 h-72 w-72 rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute -right-28 -bottom-28 h-80 w-80 rounded-full bg-indigo-100 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,_#0f172a_1px,_transparent_0)] [background-size:22px_22px]" />
      </div>

      <div className="relative z-10 grid min-h-screen place-items-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white ring-8 ring-slate-100">
                  <span className="text-[11px] font-semibold">NDH</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
                  <p className="text-xs text-slate-500">{subtitle}</p>
                </div>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>

            <div className="mb-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium uppercase">Hospital Code: {tenantCode}</span>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium tabular-nums tracking-[0.18em]">
                  Login ID: {String(loginId || '').padStart(6, '0')}
                </span>
                <button
                  type="button"
                  onClick={goBackToLogin}
                  className="ml-auto text-xs text-blue-700 underline-offset-2 hover:underline"
                >
                  Change
                </button>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="truncate text-xs">
                  OTP sent to: {maskedEmail ? maskedEmail : 'your registered email'}
                </span>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputsRef.current[i] = el)}
                    value={d}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete="one-time-code"
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    disabled={loading || resending}
                    className="h-12 rounded-2xl border border-slate-200 bg-white text-center text-lg tabular-nums tracking-[0.22em] outline-none transition
                      focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-60 sm:h-14"
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2.5 text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSubmit}
                type="submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Verifying…
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Verified
                  </>
                ) : (
                  'Verify & Continue'
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <button
                  type="button"
                  onClick={goBackToLogin}
                  className="inline-flex items-center gap-1 rounded-xl px-2 py-1 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to login
                </button>

                {seconds > 0 ? (
                  <span className="rounded-xl bg-slate-50 px-2 py-1 tabular-nums">
                    Resend in {seconds}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resending}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-2 py-1 text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    <RefreshCcw className={resending ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                    {resending ? 'Sending…' : 'Resend OTP'}
                  </button>
                )}
              </div>

              {err && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                  {err}
                </div>
              )}
            </form>
          </div>

          <div className="mx-auto mt-6 text-center text-xs text-slate-500">
            Didn’t receive the mail? Check Spam/Junk folder.
          </div>
        </div>
      </div>
    </div>
  )
}
