// frontend/src/api/masterMigrations.js
import API from './client'

// Provider-only: always skip tenant header
const metaNoTenant = { skipTenantHeader: true }

export const listTenants = () =>
    API.get('master/migrations/tenants', { meta: metaNoTenant }).then((r) => r.data)

export const tenantStorage = (tenantId) =>
    API.get(`/master/migrations/tenants/${tenantId}/storage`, { meta: metaNoTenant }).then((r) => r.data)

export const volumesStorage = () =>
    API.get('/master/migrations/storage/volumes', { meta: metaNoTenant }).then((r) => r.data)

export const allowedTypes = () =>
    API.get('/master/migrations/schema/types', { meta: metaNoTenant }).then((r) => r.data)

export const listTables = (tenantId) =>
    API.get(`/master/migrations/tenants/${tenantId}/schema/tables`, { meta: metaNoTenant }).then((r) => r.data)

export const listColumns = (tenantId, table) =>
    API.get(`/master/migrations/tenants/${tenantId}/schema/tables/${table}/columns`, { meta: metaNoTenant }).then((r) => r.data)

export const planMigration = (payload) =>
    API.post('/master/migrations/plan', payload, { meta: { ...metaNoTenant, successToast: false } }).then((r) => r.data)

export const applyMigration = (payload) =>
    API.post('/master/migrations/apply', payload, { meta: { ...metaNoTenant, successToast: true } }).then((r) => r.data)

export const listJobs = () =>
    API.get('/master/migrations/jobs', { meta: metaNoTenant }).then((r) => r.data)

export const jobDetail = (jobId) =>
    API.get(`/master/migrations/jobs/${jobId}`, { meta: metaNoTenant }).then((r) => r.data)

export const cancelJob = (jobId) =>
    API.post(`/master/migrations/jobs/${jobId}/cancel`, {}, { meta: { ...metaNoTenant, successToast: true } }).then((r) => r.data)

export const setTenantVolume = (tenantId, volume_tag) =>
    API.patch(
        `/master/migrations/tenants/${tenantId}/volume`,
        { volume_tag },
        { meta: { ...metaNoTenant, successToast: 'Volume updated' } },
    ).then((r) => r.data)
