// frontend/src/store/authStore.js
import { create } from 'zustand'
import API from '../api/client'

export const useAuth = create((set, get) => ({
    user: null,
    modules: {}, // { patients: [{ code, label }], ... }
    loading: false,
    tenantCode: localStorage.getItem('tenant_code') || '',

    setTenantCode: (tenantCode) => {
        if (tenantCode) {
            localStorage.setItem('tenant_code', tenantCode)
        } else {
            localStorage.removeItem('tenant_code')
        }
        set({ tenantCode })
    },

    // ----- ADMIN + TENANT REGISTRATION -----
    registerAdmin: async (data) => {
        const res = await API.post('/auth/register-admin', data)
        const tenant_code = res?.data?.tenant_code
        if (tenant_code) {
            localStorage.setItem('tenant_code', tenant_code)
            set({ tenantCode: tenant_code })
        }
        return res
    },

    // ----- LOGIN (tenant_code + email + password) -----
    login: async ({ tenant_code, email, password }) => {
        const payload = {
            tenant_code: tenant_code?.trim(),
            email,
            password,
        }
        const { data } = await API.post('/auth/login', payload)

        if (tenant_code) {
            localStorage.setItem('tenant_code', tenant_code.trim())
            set({ tenantCode: tenant_code.trim() })
        }

        return data
    },

    // ----- VERIFY OTP (tenant_code + email + otp) -----
    verifyOtp: async ({ tenant_code, email, otp }) => {
        const payload = {
            tenant_code: tenant_code?.trim(),
            email,
            otp,
        }
        const { data } = await API.post('/auth/verify-otp', payload)

        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        API.defaults.headers.common.Authorization = `Bearer ${data.access_token}`

        if (tenant_code) {
            localStorage.setItem('tenant_code', tenant_code.trim())
            set({ tenantCode: tenant_code.trim() })
        }

        return data
    },

    // ----- PROFILE + PERMISSIONS -----
    fetchProfile: async () => {
        try {
            set({ loading: true })
            const me = await API.get('/auth/me')
            const perms = await API.get('/auth/me/permissions')

            const tenantCode = me?.data?.tenant_code
            if (tenantCode) {
                localStorage.setItem('tenant_code', tenantCode)
            }

            set({
                user: me.data, // includes is_admin, roles[], tenant_id, tenant_code, tenant_name
                modules: perms.data.modules || {},
                tenantCode: tenantCode || get().tenantCode,
            })
        } finally {
            set({ loading: false })
        }
    },

    logout: () => {
        localStorage.clear()
        delete API.defaults.headers.common.Authorization
        set({ user: null, modules: {}, tenantCode: '' })
    },
}))
