import { create } from 'zustand'
import API from '../api/client'

export const usePatients = create((set, get) => ({
    items: [],
    loading: false,
    error: '',

    list: async (q = '') => {
        set({ loading: true, error: '' })
        try {
            const { data } = await API.get('/patients/', { params: { q } })
            set({ items: data })
        } catch (e) {
            set({ error: e?.response?.data?.detail || 'Failed to load patients' })
        } finally { set({ loading: false }) }
    },

    create: async (payload) => {
        const { data } = await API.post('/patients/', payload)
        return data
    },

    update: async (id, payload) => {
        const { data } = await API.put(`/patients/${id}`, payload)
        return data
    },

    uploadDoc: async (id, file, type = 'other') => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', type)
        const { data } = await API.post(`/patients/${id}/documents`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return data
    },

    listDocs: async (id) => {
        const { data } = await API.get(`/patients/${id}/documents`)
        return data
    },

    abhaGenerate: async ({ name, dob, mobile }) => {
        const { data } = await API.post('/abha/generate', null, { params: { name, dob, mobile } })
        return data // { txnId, debug_otp }
    },

    abhaVerify: async ({ txnId, otp, patient_id }) => {
        const { data } = await API.post('/abha/verify-otp', null, { params: { txnId, otp, patient_id } })
        return data // { abha_number }
    },
}))
