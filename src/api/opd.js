// // frontend/src/api/opd.js
// import API from './client'

// // ---------- helpers ----------
// const toParams = (obj = {}) => {
//     const out = {}
//     Object.entries(obj).forEach(([k, v]) => {
//         if (v !== undefined && v !== null && v !== '') out[k] = v
//     })
//     return out
// }

// // ---------- OPD lookups (dept, doctor, slots) ----------

// export function listOpdDepartments() {
//     return API.get('/opd/departments')
// }

// export function listOpdUsers({ departmentId, roleId, roleName, isDoctor } = {}) {
//     const params = toParams({
//         department_id: departmentId,
//         role_id: roleId,
//         role: roleName,
//         is_doctor: typeof isDoctor === 'boolean' ? isDoctor : undefined,
//     })
//     return API.get('/opd/users', { params })
// }

// export function getDoctorWeekdays(doctorUserId) {
//     return API.get('/opd/doctor-weekdays', {
//         params: { doctor_user_id: doctorUserId },
//     })
// }

// /**
//  * Detailed slot list:
//  * GET /opd/slots?doctor_user_id=&date=YYYY-MM-DD&detailed=true
//  * Response:
//  *  - { slots: [{ start, end, status }...] } OR
//  *  - [{ start, end, status }...]
//  */
// export function getDoctorSlots({ doctorUserId, date, detailed = true }) {
//     return API.get('/opd/slots', {
//         params: {
//             doctor_user_id: doctorUserId,
//             date,
//             detailed,
//         },
//     })
// }

// // For simple free-slot string list
// export function getFreeSlots({ doctorUserId, date }) {
//     return API.get('/opd/slots/free', {
//         params: { doctor_user_id: doctorUserId, date },
//     })
// }

// // ---------- Schedules ----------

// export function fetchDoctorSchedules(doctorUserId) {
//     return API.get('/opd/schedules', {
//         params: { doctor_user_id: doctorUserId },
//     })
// }

// export function saveDoctorSchedule(payload) {
//     // payload: { doctor_user_id, weekday, start_time, end_time, slot_minutes?, location?, is_active? }
//     return API.post('/opd/schedules', payload)
// }

// export function updateDoctorSchedule(id, payload) {
//     return API.put(`/opd/schedules/${id}`, payload)
// }

// export function deleteDoctorSchedule(id) {
//     return API.delete(`/opd/schedules/${id}`)
// }

// // ---------- Patient search (for PatientPicker) ----------

// export function searchPatients(q = '') {
//     const params = q ? { q } : {}
//     return API.get('/patients', { params })
// }

// // ---------- Appointments, reschedule, no-show ----------

// export function createAppointment(payload) {
//     // { patient_id, department_id, doctor_user_id, date, slot_start, slot_end?, purpose? }
//     return API.post('/opd/appointments', payload)
// }

// export function listAppointments(params = {}) {
//     // params: { date, date_str, doctor_id }
//     return API.get('/opd/appointments', { params: toParams(params) })
// }

// export function updateAppointmentStatus(appointmentId, status) {
//     return API.patch(`/opd/appointments/${appointmentId}/status`, { status })
// }

// export function rescheduleAppointment(appointmentId, payload) {
//     // { date, slot_start, create_new? }
//     return API.post(`/opd/appointments/${appointmentId}/reschedule`, payload)
// }

// export function listNoShowAppointments(params = {}) {
//     // { for_date, doctor_id }
//     return API.get('/opd/appointments/noshow', { params: toParams(params) })
// }

// // ---------- Queue & visits ----------

// export function fetchQueue(params = {}) {
//     // suggested params: { doctor_user_id, for_date, department_id? }
//     return API.get('/opd/queue', { params: toParams(params) })
// }

// export function createVisit(payload) {
//     // { appointment_id }
//     return API.post('/opd/visits', payload)
// }

// export function fetchVisit(id) {
//     return API.get(`/opd/visits/${id}`)
// }

// export function updateVisit(id, payload) {
//     return API.put(`/opd/visits/${id}`, payload)
// }

// export function listVisits(params = {}) {
//     return API.get('/opd/visits', { params: toParams(params) })
// }

// // ---------- Vitals (triage) ----------

// export function recordVitalsForPatient(patientId, payload) {
//     return API.post(`/opd/vitals/${patientId}`, payload)
// }

// export function recordVitals(payload) {
//     // flexible: { appointment_id?, patient_id?, ...vitals }
//     return API.post('/opd/vitals', payload)
// }


// // ---------- Vitals (triage) ----------

// export function fetchLatestVitals(params = {}) {
//   // params: { appointment_id?, patient_id?, for_date? }
//   return API.get('/opd/vitals/latest', { params: toParams(params) })
// }

// export function fetchVitalsHistory(params = {}) {
//   // params: { appointment_id?, patient_id?, for_date?, limit? }
//   return API.get('/opd/vitals/history', { params: toParams(params) })
// }

// // ---------- Prescription & Orders ----------

// export function savePrescription(visitId, payload) {
//     return API.post(`/opd/visits/${visitId}/prescription`, payload)
// }

// export function esignPrescription(visitId) {
//     return API.post(`/opd/visits/${visitId}/prescription/esign`)
// }

// export function createLabOrder(visitId, payload) {
//     return API.post(`/opd/visits/${visitId}/orders/lab`, payload)
// }

// export function createRadOrder(visitId, payload) {
//     return API.post(`/opd/visits/${visitId}/orders/ris`, payload)
// }

// // Lookups for LIS/RIS/Pharmacy
// export function fetchMedicines(q = '') {
//     const params = q ? { q } : {}
//     return API.get('/pharmacy/medicines/lookup', { params })
// }

// export function fetchLabTests(q = '') {
//     const params = q ? { q } : {}
//     return API.get('/lab/tests/lookup', { params })
// }

// export function fetchRadiologyTests(q = '') {
//     const params = q ? { q } : {}
//     return API.get('/radiology/tests/lookup', { params })
// }

// // ---------- Follow-up ----------

// export function createFollowup(visitId, payload) {
//     // { due_date, note? }
//     return API.post(`/opd/visits/${visitId}/followup`, payload)
// }

// export function listFollowups(params = {}) {
//     // { status, doctor_id, date_from, date_to }
//     return API.get('/opd/followups', { params: toParams(params) })
// }

// export function updateFollowup(followupId, payload) {
//     // { due_date, note? }
//     return API.put(`/opd/followups/${followupId}`, payload)
// }

// export function scheduleFollowup(followupId, payload) {
//     // e.g. { date: 'YYYY-MM-DD', slot_id: null, confirmed: true }
//     return API.post(`/opd/followups/${followupId}/schedule`, payload)
// }

// // ---------- Doctor Consultation Fees (Master) ----------

// export function listDoctorFees(params = {}) {
//     // { doctor_user_id?, department_id? }
//     return API.get('/opd/doctor-fees', { params: toParams(params) })
// }
// export function createDoctorFee(payload) {
//     // payload: { doctor_user_id, base_fee, followup_fee?, currency?, is_active? }
//     return API.post('/opd/doctor-fees', payload)
// }

// export function updateDoctorFee(id, payload) {
//     // payload: { base_fee?, followup_fee?, currency?, is_active?, notes? }
//     return API.put(`/opd/doctor-fees/${id}`, payload)
// }
// export function upsertDoctorFee(payload) {
//     if (payload.id) {
//         const { id, ...rest } = payload
//         return updateDoctorFee(id, rest)
//     }
//     return createDoctorFee(payload)
// }

// export function deleteDoctorFee(id) {
//     return API.delete(`/opd/doctor-fees/${id}`)
// }

// // ---------- Old names kept for compatibility ----------

// export function fetchDepartments() {
//     return listOpdDepartments()
// }

// export function fetchDepartmentRoles({ departmentId } = {}) {
//     const params = toParams({ department_id: departmentId })
//     return API.get('/opd/roles', { params })
// }

// export function fetchDepartmentUsers({ departmentId, roleId, isDoctor } = {}) {
//     return listOpdUsers({
//         departmentId,
//         roleId,
//         isDoctor,
//     })
// }

// // ---------- OPD Dashboard ----------

// export function fetchOpdDashboard({ dateFrom, dateTo, doctorId } = {}) {
//     return API.get('/opd/dashboard', {
//         params: toParams({
//             date_from: dateFrom,
//             date_to: dateTo,
//             doctor_id: doctorId,
//         }),
//     })
// }



import API from "./client";

// ---------- helpers ----------
const toParams = (obj = {}) => {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") out[k] = v;
    });
    return out;
};

// ---------- OPD lookups (dept, doctor, slots) ----------
export function listOpdDepartments() {
    return API.get("/opd/departments");
}

export function listOpdUsers({ departmentId, roleId, roleName, isDoctor } = {}) {
    const params = toParams({
        department_id: departmentId,
        role_id: roleId,
        role: roleName,
        is_doctor: typeof isDoctor === "boolean" ? isDoctor : undefined,
    });
    return API.get("/opd/users", { params });
}

export function getDoctorWeekdays(doctorUserId) {
    return API.get("/opd/doctor-weekdays", {
        params: { doctor_user_id: doctorUserId },
    });
}

/**
 * Detailed slot list:
 * GET /opd/slots?doctor_user_id=&date=YYYY-MM-DD&detailed=true
 * Response:
 *  - { slots: [{ start, end, status }...] } OR
 *  - [{ start, end, status }...]
 */
export function getDoctorSlots({ doctorUserId, date, detailed = true }) {
    return API.get("/opd/slots", {
        params: { doctor_user_id: doctorUserId, date, detailed },
    });
}

// For simple free-slot string list
export function getFreeSlots({ doctorUserId, date }) {
    return API.get("/opd/slots/free", {
        params: { doctor_user_id: doctorUserId, date },
    });
}

// ---------- Schedules ----------
export function fetchDoctorSchedules(doctorUserId) {
    return API.get("/opd/schedules", {
        params: { doctor_user_id: doctorUserId },
    });
}

export function saveDoctorSchedule(payload) {
    return API.post("/opd/schedules", payload);
}

export function updateDoctorSchedule(id, payload) {
    return API.put(`/opd/schedules/${id}`, payload);
}

export function deleteDoctorSchedule(id) {
    return API.delete(`/opd/schedules/${id}`);
}

// ---------- Patient search (for PatientPicker) ----------
export function searchPatients(q = "") {
    const params = q ? { q } : {};
    return API.get("/patients", { params });
}

// ---------- Appointments, reschedule, no-show ----------
export function createAppointment(payload) {
    return API.post("/opd/appointments", payload);
}

export function listAppointments(params = {}) {
    return API.get("/opd/appointments", { params: toParams(params) });
}

export function updateAppointmentStatus(appointmentId, status) {
    return API.patch(`/opd/appointments/${appointmentId}/status`, { status });
}

export function rescheduleAppointment(appointmentId, payload) {
    return API.post(`/opd/appointments/${appointmentId}/reschedule`, payload);
}

export function listNoShowAppointments(params = {}) {
    return API.get("/opd/appointments/noshow", { params: toParams(params) });
}

// ---------- Queue & visits ----------
export function fetchQueue(params = {}) {
    return API.get("/opd/queue", { params: toParams(params) });
}

export function createVisit(payload) {
    return API.post("/opd/visits", payload);
}

export function fetchVisit(id) {
    return API.get(`/opd/visits/${id}`);
}

export function updateVisit(id, payload) {
    return API.put(`/opd/visits/${id}`, payload);
}

export function listVisits(params = {}) {
    return API.get("/opd/visits", { params: toParams(params) });
}

// ---------- Vitals ----------
export function recordVitalsForPatient(patientId, payload) {
    return API.post(`/opd/vitals/${patientId}`, payload);
}

export function recordVitals(payload) {
    return API.post("/opd/vitals", payload);
}

export function fetchLatestVitals(params = {}) {
    return API.get("/opd/vitals/latest", { params: toParams(params) });
}

export function fetchVitalsHistory(params = {}) {
    return API.get("/opd/vitals/history", { params: toParams(params) });
}

// ---------- Prescription & Orders ----------
export function savePrescription(visitId, payload) {
    return API.post(`/opd/visits/${visitId}/prescription`, payload);
}

export function esignPrescription(visitId) {
    return API.post(`/opd/visits/${visitId}/prescription/esign`);
}

export function createLabOrder(visitId, payload) {
    return API.post(`/opd/visits/${visitId}/orders/lab`, payload);
}

export function createRadOrder(visitId, payload) {
    return API.post(`/opd/visits/${visitId}/orders/ris`, payload);
}

// Lookups for LIS/RIS/Pharmacy
export function fetchMedicines(q = "") {
    const params = q ? { q } : {};
    return API.get("/pharmacy/medicines/lookup", { params });
}

export function fetchLabTests(q = "") {
    const params = q ? { q } : {};
    return API.get("/lab/tests/lookup", { params });
}

export function fetchRadiologyTests(q = "") {
    const params = q ? { q } : {};
    return API.get("/radiology/tests/lookup", { params });
}

// ---------- Follow-up ----------
export function createFollowup(visitId, payload) {
    return API.post(`/opd/visits/${visitId}/followup`, payload);
}

export function listFollowups(params = {}) {
    return API.get("/opd/followups", { params: toParams(params) });
}

export function updateFollowup(followupId, payload) {
    return API.put(`/opd/followups/${followupId}`, payload);
}

export function scheduleFollowup(followupId, payload) {
    return API.post(`/opd/followups/${followupId}/schedule`, payload);
}

// ---------- Doctor Consultation Fees (Master) ----------
export function listDoctorFees(params = {}) {
    return API.get("/opd/doctor-fees", { params: toParams(params) });
}
export function createDoctorFee(payload) {
    return API.post("/opd/doctor-fees", payload);
}
export function updateDoctorFee(id, payload) {
    return API.put(`/opd/doctor-fees/${id}`, payload);
}
export function upsertDoctorFee(payload) {
    if (payload.id) {
        const { id, ...rest } = payload;
        return updateDoctorFee(id, rest);
    }
    return createDoctorFee(payload);
}
export function deleteDoctorFee(id) {
    return API.delete(`/opd/doctor-fees/${id}`);
}

// ---------- Old names kept for compatibility ----------
export function fetchDepartments() {
    return listOpdDepartments();
}

export function fetchDepartmentRoles({ departmentId } = {}) {
    const params = toParams({ department_id: departmentId });
    return API.get("/opd/roles", { params });
}

export function fetchDepartmentUsers({ departmentId, roleId, isDoctor } = {}) {
    return listOpdUsers({ departmentId, roleId, isDoctor });
}

// ---------- OPD Dashboard ----------
export function fetchOpdDashboard({ dateFrom, dateTo, doctorId } = {}) {
    return API.get("/opd/dashboard", {
        params: toParams({
            date_from: dateFrom,
            date_to: dateTo,
            doctor_id: doctorId,
        }),
    });
}


export function fetchVisitPrescription(visitId) {
    return api.get(`/opd/visits/${visitId}/prescription`)
}

export function saveVisitPrescription(visitId, payload) {
    return api.post(`/opd/visits/${visitId}/prescription`, payload)
}

export function fetchVisitSummaryPdf(visitId) {
  return api.get(`/opd/visits/${visitId}/summary.pdf`, { responseType: 'blob' })
}