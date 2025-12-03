// frontend/src/pages/auth/VerifyOtp.jsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../store/authStore'
import {
    Mail,
    ShieldCheck,
    Loader2,
    CheckCircle2,
    ArrowLeft,
    Building2,
} from 'lucide-react'

export default function VerifyOtp() {
    const loc = useLocation()
    const nav = useNavigate()
    const verifyOtp = useAuth((s) => s.verifyOtp)
    const fetchProfile = useAuth((s) => s.fetchProfile)

    // Email & tenant persist if page refreshes
    const [email] = useState(
        loc.state?.email || localStorage.getItem('pending_email') || ''
    )
    const [tenantCode] = useState(
        loc.state?.tenant_code ||
        localStorage.getItem('pending_tenant_code') ||
        localStorage.getItem('tenant_code') ||
        ''
    )

    const [digits, setDigits] = useState(['', '', '', '', '', ''])
    const [err, setErr] = useState('')
    const [loading, setLoading] = useState(false)
    const [seconds, setSeconds] = useState(60)
    const [success, setSuccess] = useState(false)

    const inputsRef = useRef([])

    useEffect(() => {
        if (!email || !tenantCode) {
            nav('/auth/login', { replace: true })
        }
    }, [email, tenantCode, nav])

    // Start resend countdown
    useEffect(() => {
        if (seconds <= 0) return
        const id = setInterval(() => setSeconds((s) => s - 1), 1000)
        return () => clearInterval(id)
    }, [seconds])

    const code = useMemo(() => digits.join(''), [digits])
    const canSubmit = code.length === 6 && !digits.includes('') && !loading

    // Handlers for OTP boxes
    const setDigit = (index, val) => {
        const v = (val || '').replace(/\D/g, '').slice(-1) // last typed digit only
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
        }
    }

    const onPaste = (e) => {
        e.preventDefault()
        const text = (e.clipboardData.getData('text') || '')
            .replace(/\D/g, '')
            .slice(0, 6)
        if (!text) return
        const arr = text.split('')
        setDigits([
            arr[0] || '',
            arr[1] || '',
            arr[2] || '',
            arr[3] || '',
            arr[4] || '',
            arr[5] || '',
        ])
        inputsRef.current[Math.min(text.length, 5)]?.focus()
    }

    const submit = async (e) => {
        e.preventDefault()
        if (!canSubmit) return
        setErr('')
        setLoading(true)
        try {
            await verifyOtp({
                tenant_code: tenantCode,
                email,
                otp: code,
            })
            await fetchProfile()
            setSuccess(true)
            // small success delay before navigation
            setTimeout(() => {
                const user = useAuth.getState().user
                if (user?.is_admin) nav('/admin', { replace: true })
                else nav('/dashboard', { replace: true })
            }, 400)
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Invalid or expired OTP')
        } finally {
            setLoading(false)
        }
    }

    const goBackToLogin = () => {
        nav('/auth/login', {
            state: { email, tenant_code: tenantCode },
            replace: true,
        })
    }

    const resend = () => {
        goBackToLogin()
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-gray-50 to-white">
            {/* soft animated blobs */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-100 blur-3xl animate-pulse" />
                <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-100 blur-3xl animate-pulse" />
            </div>

            <div className="relative z-10 grid min-h-screen place-items-center px-4 py-8">
                <div className="w-full max-w-md">
                    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white/80 p-6 shadow-sm backdrop-blur">
                        {/* Header */}
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white ring-8 ring-blue-50">
                                    <span className="text-sm font-bold">NDH</span>
                                </div>
                                <div>
                                    <h1 className="text-lg font-semibold tracking-tight">
                                        Verify OTP
                                    </h1>
                                    <p className="text-xs text-gray-500">
                                        We sent a 6-digit code to your email
                                    </p>
                                </div>
                            </div>
                            <ShieldCheck className="h-6 w-6 text-emerald-600" />
                        </div>

                        {/* Email + Tenant info */}
                        <div className="mb-4 space-y-2 text-sm">
                            <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-gray-700">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{email}</span>
                                <button
                                    type="button"
                                    onClick={goBackToLogin}
                                    className="ml-auto text-xs text-blue-700 underline-offset-2 hover:underline"
                                >
                                    Change
                                </button>
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-gray-700">
                                <Building2 className="h-4 w-4 text-gray-400" />
                                <span className="text-xs font-medium uppercase">
                                    Hospital Code: {tenantCode}
                                </span>
                            </div>
                        </div>

                        {/* OTP inputs */}
                        <form onSubmit={submit} className="space-y-4">
                            <div
                                className="grid grid-cols-6 gap-2 sm:gap-3"
                                onPaste={onPaste}
                            >
                                {digits.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => (inputsRef.current[i] = el)}
                                        value={d}
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        autoFocus={i === 0}
                                        onChange={(e) => setDigit(i, e.target.value)}
                                        onKeyDown={(e) => onKeyDown(i, e)}
                                        className="h-12 rounded-xl border border-gray-200 text-center text-lg tracking-[0.2em] outline-none transition
                               focus:border-blue-400 focus:ring-2 focus:ring-blue-200 sm:h-14"
                                        aria-label={`OTP digit ${i + 1}`}
                                    />
                                ))}
                            </div>

                            {/* Actions */}
                            <button
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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

                            {/* Resend & back */}
                            <div className="flex items-center justify-between text-xs text-gray-600">
                                <button
                                    type="button"
                                    onClick={goBackToLogin}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-gray-50"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    Back to login
                                </button>

                                <div className="flex items-center gap-2">
                                    {seconds > 0 ? (
                                        <span className="rounded-lg bg-gray-50 px-2 py-1 tabular-nums">
                                            Resend in {seconds}s
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={resend}
                                            className="rounded-lg bg-gray-900 px-2 py-1 text-white hover:bg-gray-800"
                                        >
                                            Resend OTP
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Error */}
                            {err && (
                                <div
                                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                                    role="alert"
                                    aria-live="polite"
                                >
                                    {err}
                                </div>
                            )}
                        </form>

                        {/* Loading overlay */}
                        {loading && (
                            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-sm">
                                <div className="w-full max-w-xs rounded-xl border border-gray-100 bg-white p-4 shadow-md">
                                    <div className="mb-2 flex items-center gap-2 text-sm text-gray-700">
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        Verifying…
                                    </div>
                                    <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
                                        <div className="absolute inset-y-0 left-0 w-1/3 animate-[progress_1.1s_infinite_linear] rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer mini note */}
                    <div className="mx-auto mt-6 text-center text-xs text-gray-500">
                        Didn’t receive the mail? Check Spam/Junk folder.
                    </div>
                </div>
            </div>

            {/* Keyframes for progress bar */}
            <style>{`
        @keyframes progress {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
        </div>
    )
}
