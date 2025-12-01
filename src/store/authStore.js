// frontend/src/store/authStore.js
import { create } from 'zustand'
import API from '../api/client'

export const useAuth = create((set) => ({
    user: null,
    modules: {},     // { patients: [{ code, label }], ... }
    loading: false,

    registerAdmin: async (data) => API.post('/auth/register-admin', data),

    login: async ({ email, password }) => {
        const { data } = await API.post('/auth/login', { email, password })
        return data
    },

    verifyOtp: async ({ email, otp }) => {
        const { data } = await API.post('/auth/verify-otp', { email, otp })
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        API.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
        return data
    },

    fetchProfile: async () => {
        try {
            set({ loading: true })
            const me = await API.get('/auth/me')
            const perms = await API.get('/auth/me/permissions')
            set({
                user: me.data,           // must include is_admin, roles[]
                modules: perms.data.modules || {},
            })
        } finally {
            set({ loading: false })
        }
    },

    logout: () => {
        localStorage.clear()
        delete API.defaults.headers.common.Authorization
        set({ user: null, modules: {} })
    },
}))
