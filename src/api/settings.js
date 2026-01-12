import API from './client'

// ----- GLOBAL -----
export const getPublicBranding = (context) =>
  API.get('/settings/ui-branding/public', { params: context ? { context } : {} })

export const getBranding = () => API.get('/settings/ui-branding')

export const updateBranding = (payload) => API.put('/settings/ui-branding', payload)

export const uploadBrandingAssets = (formData) =>
  API.post('/settings/ui-branding/assets', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// ----- CONTEXT (pharmacy etc.) -----
export const getBrandingContext = (code) =>
  API.get(`/settings/ui-branding/contexts/${code}`)

export const updateBrandingContext = (code, payload) =>
  API.put(`/settings/ui-branding/contexts/${code}`, payload)

export const uploadBrandingContextAssets = (code, formData) =>
  API.post(`/settings/ui-branding/contexts/${code}/assets`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
