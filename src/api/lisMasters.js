// FILE: frontend/src/api/lisMasters.js
import API from './client'

// ---------- Departments ----------

export function listLabDepartments({ active_only = true } = {}) {
    const params = { active_only }
    return API.get('/lis/masters/departments', { params })
}

export function createLabDepartment(payload) {
    return API.post('/lis/masters/departments', payload)
}

export function updateLabDepartment(deptId, payload) {
    return API.put(`/lis/masters/departments/${deptId}`, payload)
}

export function deleteLabDepartment(deptId) {
    return API.delete(`/lis/masters/departments/${deptId}`)
}

// ---------- Services ----------

export function listLabServices({ department_id, search, active_only = true } = {}) {
    const params = {}
    if (department_id) params.department_id = department_id
    if (search) params.search = search
    params.active_only = active_only
    return API.get('/lis/masters/services', { params })
}

export function createLabService(payload) {
    return API.post('/lis/masters/services', payload)
}

export function bulkCreateLabServices(items) {
    return API.post('/lis/masters/services/bulk', { items })
}

export function updateLabService(serviceId, payload) {
    return API.put(`/lis/masters/services/${serviceId}`, payload)
}

export function deleteLabService(serviceId) {
    return API.delete(`/lis/masters/services/${serviceId}`)
}
