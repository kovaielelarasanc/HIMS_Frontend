// FILE: frontend/src/api/settings.js
import API from './client'

export function getPublicBranding() {
  return API.get('/settings/ui-branding/public')
}

export function getBranding() {
  return API.get('/settings/ui-branding')
}

export function updateBranding(payload) {
  return API.put('/settings/ui-branding', payload)
}

export function uploadBrandingAssets(formData) {
  return API.post('/settings/ui-branding/assets', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// NEW: upload letterhead (PDF / image / doc)
export function uploadLetterhead(formData) {
  return API.post('/settings/ui-branding/letterhead', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
