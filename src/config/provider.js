// src/config/provider.js
export const PROVIDER_TENANT_CODE = 'NUTRYAH' // ✅ hardcode

const base64UrlToJson = (b64url) => {
  const b64 = String(b64url || '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  return JSON.parse(atob(b64 + pad))
}

export const decodeJwtPayload = (token) => {
  try {
    if (!token) return null
    const parts = token.split('.')
    if (parts.length < 2) return null
    return base64UrlToJson(parts[1])
  } catch {
    return null
  }
}

export const isProviderTenant = () => {
  const provider = PROVIDER_TENANT_CODE.trim().toUpperCase()

  const lsCode = String(localStorage.getItem('tenant_code') || '').trim().toUpperCase()
  const token = localStorage.getItem('access_token')
  const jwt = decodeJwtPayload(token)
  const jwtCode = String(jwt?.tcode || '').trim().toUpperCase()

  return lsCode === provider || jwtCode === provider
}