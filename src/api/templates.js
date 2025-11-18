import API from './client'

// ===== Templates =====
export const listTemplates = (params = {}) =>
    API.get('/templates/templates', { params })

export const getTemplate = (id) =>
    API.get(`/templates/templates/${id}`)

export const createTemplate = (payload) =>
    API.post('/templates/templates', payload)

export const updateTemplate = (id, payload) =>
    API.patch(`/templates/templates/${id}`, payload)

export const deleteTemplate = (id) =>
    API.delete(`/templates/templates/${id}`)

// Render (HTML) for preview (merge with patient context)
export const renderTemplateHTML = (templateId, patient_id, data = null) =>
    API.post(
        `/templates/templates/${templateId}/render-html`,
        data ? { data } : {},
        { params: { patient_id } },
    )

// GET download (simple)
export const downloadTemplatePDF = async (templateId, patient_id) => {
    const res = await API.get(`/templates/templates/${templateId}/pdf`, {
        params: { patient_id, inline: false },
        responseType: 'blob',
    })
    return res.data
}

// POST download (lets you choose engine and pass extra data)
export const downloadTemplatePDFPost = async (templateId, body) => {
    const res = await API.post(`/templates/templates/${templateId}/pdf`, body, {
        responseType: 'blob',
    })
    return res.data
}

// ===== Consents =====
export const createConsent = (patient_id, payload) =>
    API.post(`/templates/patients/${patient_id}/consents`, payload)

export const listConsents = (patient_id) =>
    API.get(`/templates/patients/${patient_id}/consents`)

// ===== Files (for editor image upload) =====
export const uploadFile = async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await API.post('/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data // { file_url, file_url_abs, ... }
}
