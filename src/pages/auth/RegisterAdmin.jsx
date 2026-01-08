// FILE: frontend/src/pages/auth/RegisterAdmin.jsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { useAuth } from '../../store/authStore'

import {
  Building2,
  User,
  Phone,
  MapPin,
  ShieldPlus,
  KeyRound,
  Mail,
  Lock,
  CheckCircle2,
  Copy,
  ArrowRight,
  Loader2,
  X,
  BadgeCheck,
  Sparkles,
} from 'lucide-react'

const cx = (...a) => a.filter(Boolean).join(' ')

function unwrap(res) {
  // supports either axios response or direct data object
  return res?.data ?? res
}

function safeDetail(err) {
  const d = err?.response?.data
  if (!d) return err?.message || 'Request failed'
  if (typeof d.detail === 'string') return d.detail
  if (typeof d.message === 'string') return d.message
  try {
    return JSON.stringify(d)
  } catch {
    return 'Request failed'
  }
}

function normalizePayload(form) {
  const tcode = (form.tenant_code || '').trim().toUpperCase()
  const phone = (form.contact_phone || '').trim()
  const addr = (form.hospital_address || '').trim()

  return {
    tenant_name: (form.tenant_name || '').trim(),
    tenant_code: tcode ? tcode : null, // ✅ important (backend derives if None)
    hospital_address: addr ? addr : null,
    contact_person: (form.contact_person || '').trim(),
    contact_phone: phone ? phone : null,

    subscription_plan: (form.subscription_plan || '').trim() || null,
    amc_percent: 30, // ✅ keep default unless you expose it

    admin_name: (form.admin_name || '').trim(),
    email: (form.email || '').trim().toLowerCase(),
    password: form.password || '',
    confirm_password: form.confirm_password || '',
  }
}

export default function RegisterAdmin() {
  const registerAdmin = useAuth((s) => s.registerAdmin)
  const nav = useNavigate()

  const [form, setForm] = useState({
    tenant_name: '',
    tenant_code: '',
    hospital_address: '',
    contact_person: '',
    contact_phone: '',
    subscription_plan: 'standard',
    admin_name: '',
    email: '',
    password: '',
    confirm_password: '',
  })

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [success, setSuccess] = useState({
    open: false,
    tenant_code: '',
    tenant_id: null,
    admin_login_id: '',
    otp_required: false,
    purpose: '',
    masked_email: '',
    message: '',
  })

  const derivedCodePreview = useMemo(() => {
    const s = (form.tenant_code || '').trim()
    if (s) return s.toUpperCase()
    const n = (form.tenant_name || '').trim()
    if (!n) return ''
    return n.replace(/\s+/g, '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 16)
  }, [form.tenant_code, form.tenant_name])

  const onChange = (field) => (e) =>
    setForm((f) => ({
      ...f,
      [field]: e.target.value,
    }))

  const validate = () => {
    const p = normalizePayload(form)
    if (!p.tenant_name) return 'Hospital / Clinic Name is required.'
    if (!p.contact_person) return 'Contact Person is required.'
    if (!p.admin_name) return 'Admin Name is required.'
    if (!p.email) return 'Admin Email is required.'
    if (!p.password || p.password.length < 8) return 'Password must be at least 8 characters.'
    if (p.password !== p.confirm_password) return 'Passwords do not match.'
    return ''
  }

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return
    setErr('')

    const v = validate()
    if (v) {
      setErr(v)
      return
    }

    const payload = normalizePayload(form)

    setLoading(true)
    try {
      const res = await registerAdmin(payload)
      const data = unwrap(res)

      const tenant_code = data?.tenant_code || payload.tenant_code || ''
      const admin_login_id = data?.admin_login_id || ''
      const masked_email = data?.masked_email || ''
      const otp_required = !!data?.otp_required
      const purpose = data?.purpose || ''
      const tenant_id = data?.tenant_id ?? null

      setSuccess({
        open: true,
        tenant_code,
        tenant_id,
        admin_login_id,
        otp_required,
        purpose,
        masked_email,
        message: data?.message || 'Hospital onboarded successfully.',
      })

      toast.success('Tenant created')
    } catch (e2) {
      setErr(safeDetail(e2) || 'Failed to register tenant admin')
      toast.error('Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const goLogin = () => {
    const tenant_code = success.tenant_code || derivedCodePreview || ''
    nav('/auth/login', {
      replace: true,
      state: {
        tenant_code,
        login_id: success.admin_login_id || '',
        // optional for your login UI
        masked_email: success.masked_email || '',
        otp_purpose: success.purpose || '',
      },
    })
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Premium background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_transparent_55%)]" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-6 px-4 py-8 md:grid-cols-2 md:items-center md:py-12">
        {/* Left: Hero */}
        <div className="order-2 md:order-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Nutryah NABH HIMS · Hospital Onboarding
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            Create tenant + Admin in one step.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
            This will provision a dedicated tenant database/schema and create the Admin account with a
            system-generated <span className="font-semibold text-slate-800">6-digit Login ID</span>.
          </p>

          <div className="mt-6 space-y-3">
            <FeatureRow
              icon={<KeyRound className="h-4 w-4 text-slate-700" />}
              title="6-digit Login ID"
              desc="Generated automatically after creation. You’ll see it in the success popup."
            />
            <FeatureRow
              icon={<ShieldPlus className="h-4 w-4 text-emerald-700" />}
              title="Admin security defaults"
              desc={
                <>
                  Admin is created with{' '}
                  <span className="font-semibold text-slate-800">2FA ON</span> and{' '}
                  <span className="font-semibold text-slate-800">Multi-Login OFF</span>.
                </>
              }
            />
            <FeatureRow
              icon={<BadgeCheck className="h-4 w-4 text-blue-700" />}
              title="Email verification"
              desc="If OTP is required, we’ll display the masked email in the popup."
            />
          </div>

          {/* Preview card */}
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-800">Tenant Code preview</div>
                <div className="mt-1 text-sm text-slate-600">
                  {derivedCodePreview ? (
                    <span className="font-semibold tracking-wide text-slate-900">{derivedCodePreview}</span>
                  ) : (
                    <span className="text-slate-400">Enter hospital name to preview</span>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                India (+91) supported
              </div>
            </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="order-1 md:order-2">
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur md:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm ring-8 ring-slate-100">
                  <span className="text-[11px] font-semibold">NDH</span>
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">Register Tenant Admin</div>
                  <div className="text-[11px] text-slate-500">
                    Create hospital + admin account
                  </div>
                </div>
              </div>

              <div className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 md:inline-flex">
                Nutryah-premium UI
              </div>
            </div>

            {/* Hospital info */}
            <div className="mt-5 grid gap-3">
              <Field
                label="Hospital / Clinic Name"
                icon={<Building2 className="h-4 w-4 text-slate-400" />}
              >
                <input
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="Kovai Multispeciality Hospital"
                  value={form.tenant_name}
                  onChange={onChange('tenant_name')}
                  required
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <LabelRow label="Hospital Code (Tenant Code)" hint="Optional" />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
                    placeholder="KGH001"
                    value={form.tenant_code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tenant_code: e.target.value.toUpperCase() }))
                    }
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Leave empty to auto-generate.
                  </p>
                </div>

                <div>
                  <LabelRow label="Subscription Plan" />
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.subscription_plan}
                    onChange={onChange('subscription_plan')}
                  >
                    <option value="basic">Basic (Monthly)</option>
                    <option value="standard">Standard (6 Months)</option>
                    <option value="premium">Premium (1 Year)</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Contact Person" icon={<User className="h-4 w-4 text-slate-400" />}>
                  <input
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="IT Head / Admin"
                    value={form.contact_person}
                    onChange={onChange('contact_person')}
                    required
                  />
                </Field>

                <Field label="Contact Phone" icon={<Phone className="h-4 w-4 text-slate-400" />}>
                  <input
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="+91 9XXXXXXXXX"
                    value={form.contact_phone}
                    onChange={onChange('contact_phone')}
                  />
                </Field>
              </div>

              <div>
                <LabelRow label="Hospital Address" hint="Optional" />
                <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-200">
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                  <textarea
                    className="w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Address, City, State, Pincode"
                    rows={2}
                    value={form.hospital_address}
                    onChange={onChange('hospital_address')}
                  />
                </div>
              </div>
            </div>

            {/* Admin account */}
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">Admin Account</div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                  <ShieldPlus className="h-3.5 w-3.5 text-emerald-700" />
                  2FA ON · Multi-Login OFF
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Admin Name" icon={<User className="h-4 w-4 text-slate-400" />}>
                  <input
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Super Admin"
                    value={form.admin_name}
                    onChange={onChange('admin_name')}
                    required
                  />
                </Field>

                <Field label="Admin Email" icon={<Mail className="h-4 w-4 text-slate-400" />}>
                  <input
                    type="email"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="admin@hospital.org"
                    value={form.email}
                    onChange={onChange('email')}
                    required
                  />
                </Field>

                <Field label="Password" icon={<Lock className="h-4 w-4 text-slate-400" />}>
                  <input
                    type="password"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    value={form.password}
                    onChange={onChange('password')}
                    required
                  />
                </Field>

                <Field label="Confirm Password" icon={<Lock className="h-4 w-4 text-slate-400" />}>
                  <input
                    type="password"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    value={form.confirm_password}
                    onChange={onChange('confirm_password')}
                    required
                  />
                </Field>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                <KeyRound className="mt-0.5 h-4 w-4 text-slate-400" />
                <p className="leading-relaxed">
                  All users login using a system-generated{' '}
                  <span className="font-semibold text-slate-800">6-digit Login ID</span>. After creation,
                  you’ll see the Admin Login ID in a popup.
                </p>
              </div>
            </div>

            {err && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cx(
                'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]',
                loading ? 'bg-slate-700/70' : 'bg-slate-900 hover:bg-black',
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Tenant…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Create Tenant & Admin
                </>
              )}
            </button>

            <p className="mt-3 text-center text-[11px] text-slate-500">
              After onboarding, login using Hospital Code + Admin Login ID.
            </p>
          </motion.form>
        </div>
      </div>

      {/* Success popup */}
      <AnimatePresence>
        {success.open && (
          <SuccessModal
            data={success}
            onClose={() => setSuccess((s) => ({ ...s, open: false }))}
            onGoLogin={goLogin}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ----------------------------- UI bits ----------------------------- */

function LabelRow({ label, hint }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <div className="text-xs font-medium text-slate-700">{label}</div>
      {hint ? (
        <div className="text-[10px] font-semibold text-slate-400">{hint}</div>
      ) : null}
    </div>
  )
}

function Field({ label, icon, children }) {
  return (
    <div>
      <LabelRow label={label} />
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-200">
        {icon}
        {children}
      </div>
    </div>
  )
}

function FeatureRow({ icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
      <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-900/5 text-slate-900">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-[12px] leading-relaxed text-slate-600">{desc}</div>
      </div>
    </div>
  )
}

function SuccessModal({ data, onClose, onGoLogin }) {
  const [copying, setCopying] = useState({ tenant: false, login: false })

  const copyText = async (text, which) => {
    try {
      if (!text) return
      setCopying((s) => ({ ...s, [which]: true }))
      await navigator.clipboard.writeText(String(text))
      toast.success('Copied')
    } catch {
      toast.error('Copy failed')
    } finally {
      setCopying((s) => ({ ...s, [which]: false }))
    }
  }

  const tenantCode = data?.tenant_code || ''
  const loginId = data?.admin_login_id || ''
  const maskedEmail = data?.masked_email || ''
  const otpRequired = !!data?.otp_required

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        onMouseDown={(e) => e.stopPropagation()}
        initial={{ y: 30, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-5 text-white">
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top,_#93c5fd,_transparent_55%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Created successfully
              </div>
              <div className="mt-2 text-lg font-semibold tracking-tight">
                Tenant & Admin provisioned
              </div>
              <div className="mt-1 text-xs text-white/80">
                Save these details — you’ll need them to login.
              </div>
            </div>

            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15"
              type="button"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <InfoRow
            label="Tenant Code"
            value={tenantCode || 'Generated'}
            right={
              tenantCode ? (
                <button
                  type="button"
                  onClick={() => copyText(tenantCode, 'tenant')}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copying.tenant ? 'Copying…' : 'Copy'}
                </button>
              ) : null
            }
          />

          <InfoRow
            label="Admin Login ID"
            value={loginId ? String(loginId).padStart(6, '0') : 'Not returned'}
            right={
              loginId ? (
                <button
                  type="button"
                  onClick={() => copyText(loginId, 'login')}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copying.login ? 'Copying…' : 'Copy'}
                </button>
              ) : null
            }
          />

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-900">Security defaults</div>
                <div className="text-[12px] text-slate-600">
                  Admin created with <span className="font-semibold text-slate-800">2FA ON</span> and{' '}
                  <span className="font-semibold text-slate-800">Multi-Login OFF</span>.
                </div>

                {otpRequired && (
                  <div className="mt-2 text-[12px] text-slate-700">
                    OTP sent to <span className="font-semibold">{maskedEmail || 'registered email'}</span>.
                    Complete verification during first login.
                  </div>
                )}
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white">
                <ShieldPlus className="h-5 w-5 text-emerald-700" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onGoLogin}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Proceed to Login
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function InfoRow({ label, value, right }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-semibold text-slate-900">{value}</div>
      </div>
      {right}
    </div>
  )
}
