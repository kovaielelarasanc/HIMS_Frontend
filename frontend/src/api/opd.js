import API from './client'

// Lookups
export const fetchDepartments = () => API.get('/opd/departments')
export const fetchRolesByDepartment = (department_id) =>
    API.get('/opd/roles', { params: { department_id } })
export const fetchDepartmentUsers = (department_id, role_id) =>
    API.get('/opd/users', { params: { department_id, role_id } })

// Patients
export const searchPatients = (q) =>
    API.get('/patients', { params: { q } })

// Schedules
export const fetchDoctorSchedules = (doctor_user_id) =>
    API.get('/opd/schedules', { params: { doctor_user_id } })
export const fetchDoctorWeekdays = (doctor_user_id) =>
    API.get('/opd/doctor-weekdays', { params: { doctor_user_id } })
export const saveDoctorSchedule = (payload) =>
    API.post('/opd/schedules', payload)

// Slots (unified) -> returns [{start,end}]
export const getFreeSlots = async (doctor_user_id, dateISO) => {
    try {
        // Ask for detailed status (free/booked/past)
        return await API.get('/opd/slots', { params: { doctor_user_id, date_str: dateISO, detailed: 1 } })
    } catch (e) {
        // Fallback to the "free only" legacy endpoints
        try {
            return await API.get('/opd/slots', { params: { doctor_user_id, date: dateISO } })
        } catch {
            return await API.get('/opd/slots/free', { params: { doctor_user_id, date: dateISO } })
        }
    }
}


// Appointments
export const createAppointment = (payload) =>
    API.post('/opd/appointments', payload)
export const fetchAppointments = (params = {}) =>
    API.get('/opd/appointments', { params })
export const updateAppointmentStatus = (id, status) =>
    API.patch(`/opd/appointments/${id}/status`, { status })

// Vitals & Queue
export const recordVitals = (patient_id, payload) =>
    API.post(`/opd/vitals/${patient_id}`, payload)
export const fetchQueue = ({ doctor_user_id, for_date }) =>
    API.get('/opd/queue', { params: { doctor_user_id, ...(for_date ? { for_date } : {}) } })

// Visits
export const createVisit = (payload) => API.post('/opd/visits', payload)
export const fetchVisit = (visit_id) => API.get(`/opd/visits/${visit_id}`)
export const updateVisit = (visit_id, payload) => API.put(`/opd/visits/${visit_id}`, payload)

// Rx & Orders
export const savePrescription = (visit_id, payload) =>
    API.post(`/opd/visits/${visit_id}/prescription`, payload)
export const esignPrescription = (visit_id) =>
    API.post(`/opd/visits/${visit_id}/prescription/esign`, {})

export const createLabOrder = (visit_id, payload) =>
    API.post(`/opd/visits/${visit_id}/orders/lab`, payload)
export const createRadOrder = (visit_id, payload) =>
    API.post(`/opd/visits/${visit_id}/orders/radiology`, payload)

// Masters
export const fetchMedicines = (q) =>
    API.get('/masters/medicines', { params: { q } })
export const createMedicine = (payload) =>
    API.post('/masters/medicines', payload)

export const fetchLabTests = (q) =>
    API.get('/masters/lab-tests', { params: { q } })
export const createLabTest = (payload) =>
    API.post('/masters/lab-tests', payload)

export const fetchRadiologyTests = (q) =>
    API.get('/masters/radiology-tests', { params: { q } })
export const createRadiologyTest = (payload) =>
    API.post('/masters/radiology-tests', payload)
