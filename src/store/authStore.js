// frontend/src/store/authStore.js
import { create } from 'zustand'
import API from '../api/client'

function setTokens({ access_token, refresh_token }) {
  if (access_token) {
    localStorage.setItem('access_token', access_token)
    API.defaults.headers.common.Authorization = `Bearer ${access_token}`
  }
  if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
}

function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  delete API.defaults.headers.common.Authorization
}

export const useAuth = create((set, get) => ({
  user: null,
  modules: {},
  loading: false,
  tenantCode: localStorage.getItem('tenant_code') || '',

  setTenantCode: (tenantCode) => {
    const code = (tenantCode || '').trim().toUpperCase()
    if (code) localStorage.setItem('tenant_code', code)
    else localStorage.removeItem('tenant_code')
    set({ tenantCode: code })
  },

  // ----- ADMIN + TENANT REGISTRATION -----
  registerAdmin: async (data) => {
    const res = await API.post('/auth/register-admin', data)
    const tenant_code = res?.data?.tenant_code
    if (tenant_code) {
      localStorage.setItem('tenant_code', String(tenant_code).trim().toUpperCase())
      set({ tenantCode: String(tenant_code).trim().toUpperCase() })
    }
    return res
  },

  // ----- LOGIN (tenant_code + login_id + password)
  // Backend can return:
  //   A) { otp_required:false, access_token, refresh_token }
  //   B) { otp_required:true, purpose:"login"|"email_verify", masked_email }
  login: async ({ tenant_code, login_id, password }) => {
    const tcode = (tenant_code || get().tenantCode || '').trim().toUpperCase()
    const payload = {
      tenant_code: tcode,
      login_id: String(login_id || '').trim(),
      password: password || '',
    }

    const { data } = await API.post('/auth/login', payload)

    if (tcode) {
      localStorage.setItem('tenant_code', tcode)
      set({ tenantCode: tcode })
    }

    // Direct token login (2FA disabled)
    if (data?.access_token) setTokens(data)

    return data
  },

  // ----- VERIFY OTP (tenant_code + login_id + otp_code + purpose)
  verifyOtp: async ({ tenant_code, login_id, otp, purpose }) => {
    const tcode = (tenant_code || get().tenantCode || '').trim().toUpperCase()

    const payload = {
      tenant_code: tcode,
      login_id: String(login_id || '').trim(),
      otp_code: String(otp || '').trim(), // ✅ backend alias supported
      purpose: (purpose || 'login').trim(), // ✅ IMPORTANT
    }

    const { data } = await API.post('/auth/verify-otp', payload)

    // verify-otp always returns tokens
    setTokens(data)

    if (tcode) {
      localStorage.setItem('tenant_code', tcode)
      set({ tenantCode: tcode })
    }

    return data
  },

  // ----- RESEND OTP (tenant_code + login_id + purpose)
  // Backend route: POST /auth/resend-otp
  resendOtp: async ({ tenant_code, login_id, purpose }) => {
    const tcode = (tenant_code || get().tenantCode || '').trim().toUpperCase()

    const payload = {
      tenant_code: tcode,
      login_id: String(login_id || '').trim(),
      purpose: (purpose || 'login').trim(), // "login" or "email_verify"
    }

    const { data } = await API.post('/auth/resend-otp', payload)
    return data
  },

  // ----- PROFILE + PERMISSIONS -----
  fetchProfile: async () => {
    try {
      set({ loading: true })

      const me = await API.get('/auth/me')
      const perms = await API.get('/auth/me/permissions')

      const tenantCode = (me?.data?.tenant_code || get().tenantCode || '').trim().toUpperCase()
      if (tenantCode) localStorage.setItem('tenant_code', tenantCode)

      set({
        user: me.data,
        modules: perms.data.modules || {},
        tenantCode,
      })
    } finally {
      set({ loading: false })
    }
  },

  // ----- LOGOUT -----
  logout: async () => {
    // try to revoke server-side session
    try {
      await API.post('/auth/logout')
    } catch {
      // ignore
    }

    clearTokens()
    localStorage.removeItem('tenant_code')
    localStorage.removeItem('user')
    set({ user: null, modules: {}, tenantCode: '' })
  },
}))
