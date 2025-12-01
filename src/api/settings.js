// frontend/src/api/settings.js
import API from './client'

// Get current UI branding (colors + image URLs)
export function getBranding() {
  return API.get('/settings/ui-branding')
}

// Update only color values
export function updateBranding(payload) {
  return API.put('/settings/ui-branding', payload)
}

// Upload logo + PDF header/footer images
export function uploadBrandingAssets(formData) {
  return API.post('/settings/ui-branding/assets', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
