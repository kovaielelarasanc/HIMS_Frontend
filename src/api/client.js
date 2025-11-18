// frontend/src/api/client.js
import axios from 'axios'
import { toast } from 'sonner'
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  withCredentials: true,
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
API.interceptors.response.use(
  res => res,
  err => {
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      'Unexpected error'
    toast.error(msg)
    return Promise.reject(err)
  }
)

API.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      localStorage.clear()
      delete API.defaults.headers.common.Authorization
      // optional: redirect
      // window.location.assign('/auth/login')
    }
    return Promise.reject(error)
  }
)

export default API
