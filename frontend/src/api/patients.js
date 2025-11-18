import API from './client'

export const getPatientById = (id) => API.get(`/patients/${id}`)
// If your backend uses a different route, adjust above.
