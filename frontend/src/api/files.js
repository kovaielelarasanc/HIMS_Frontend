// src/api/files.js
import API from './client'

export const uploadFile = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await API.post('/files/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })
    // backend should return { url: '...' } or full object – normalize to url
    return data?.url || data?.file_url || data?.path || ''
}
