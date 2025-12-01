// frontend/src/api/client.js
import axios from 'axios'
import { toast } from 'sonner'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  // baseURL: import.meta.env.VITE_API_URL || 'https://api.nutryah.com/api',
  withCredentials: true,
})

// Attach token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Unified error handler (includes 401 + validation errors)
API.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const data = error?.response?.data
    const detail = data?.detail
    let msg = 'Unexpected error'

    if (Array.isArray(detail)) {
      // FastAPI / Pydantic validation errors
      msg = detail
        .map((e) => {
          const loc = Array.isArray(e.loc) ? e.loc.join('.') : e.loc
          return `${loc}: ${e.msg}`
        })
        .join('\n')
    } else if (typeof detail === 'string') {
      msg = detail
    } else if (typeof data?.message === 'string') {
      msg = data.message
    } else if (error?.message) {
      msg = error.message
    }

    // Handle auth expiry
    if (status === 401) {
      localStorage.clear()
      delete API.defaults.headers.common.Authorization
      // optional: redirect
      // window.location.assign('/auth/login')
    }
    
    console.error('API error:', status, data)
    toast.error(msg) // always a string now

    return Promise.reject(error)
  }
)

export default API
