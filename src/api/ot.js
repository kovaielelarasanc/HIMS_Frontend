// FILE: frontend/src/api/ot.js
import API from './client'

// ---------- helpers ----------
const toParams = (obj = {}) => {
    const out = {}
    Object.entries(obj).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') out[k] = v
    })
    return out
}

// ============================================================
//  OT MASTERS
// ============================================================

// ---------- OT SPECIALITIES ----------

export function listOtSpecialities({ active, search } = {}) {
    const params = toParams({
        active,
        search,
    })
    return API.get('/ot/specialities', { params })
}

export function getOtSpeciality(id) {
    return API.get(`/ot/specialities/${id}`)
}

export function createOtSpeciality(data) {
    return API.post('/ot/specialities', data)
}

export function updateOtSpeciality(id, data) {
    return API.put(`/ot/specialities/${id}`, data)
}

export function deleteOtSpeciality(id) {
    return API.delete(`/ot/specialities/${id}`)
}

// ---------- OT THEATRES ----------

export function listOtTheatres({ active, search, specialityId } = {}) {
    const params = toParams({
        active,
        search,
        speciality_id: specialityId,
    })
    return API.get('/ot/theatres', { params })
}

export function getOtTheatre(id) {
    return API.get(`/ot/theatres/${id}`)
}

export function createOtTheatre(data) {
    return API.post('/ot/theatres', data)
}

export function updateOtTheatre(id, data) {
    return API.put(`/ot/theatres/${id}`, data)
}

export function deleteOtTheatre(id) {
    return API.delete(`/ot/theatres/${id}`)
}

// ---------- OT EQUIPMENT MASTER ----------

export function listOtEquipment({ active, search, critical } = {}) {
    const params = toParams({
        active,
        search,
        critical,
    })
    return API.get('/ot/equipment', { params })
}

export function getOtEquipment(id) {
    return API.get(`/ot/equipment/${id}`)
}

export function createOtEquipment(data) {
    return API.post('/ot/equipment', data)
}

export function updateOtEquipment(id, data) {
    return API.put(`/ot/equipment/${id}`, data)
}

export function deleteOtEquipment(id) {
    return API.delete(`/ot/equipment/${id}`)
}

// ---------- OT ENVIRONMENT SETTINGS ----------

export function listOtEnvironmentSettings({ theatreId } = {}) {
    const params = toParams({
        theatre_id: theatreId,
    })
    return API.get('/ot/environment-settings', { params })
}

export function getOtEnvironmentSetting(id) {
    return API.get(`/ot/environment-settings/${id}`)
}

export function createOtEnvironmentSetting(data) {
    return API.post('/ot/environment-settings', data)
}

export function updateOtEnvironmentSetting(id, data) {
    return API.put(`/ot/environment-settings/${id}`, data)
}

export function deleteOtEnvironmentSetting(id) {
    return API.delete(`/ot/environment-settings/${id}`)
}

// ============================================================
//  OT SCHEDULE
// ============================================================

export function listOtSchedules({
    date,
    theatreId,
    surgeonUserId,
    patientId,
    status,
} = {}) {
    const params = toParams({
        date,
        theatre_id: theatreId,
        surgeon_user_id: surgeonUserId,
        patient_id: patientId,
        status,
    })
    return API.get('/ot/schedule', { params })
}

export function getOtSchedule(id) {
    return API.get(`/ot/schedule/${id}`)
}

export function createOtSchedule(data) {
    return API.post('/ot/schedule', data)
}

export function updateOtSchedule(id, data) {
    return API.put(`/ot/schedule/${id}`, data)
}

export function cancelOtSchedule(id, reason) {
    const params = toParams({ reason })
    return API.post(`/ot/schedule/${id}/cancel`, null, { params })
}

export function deleteOtSchedule(id) {
    return API.delete(`/ot/schedule/${id}`)
}

// ============================================================
//  OT CASES
// ============================================================

export function listOtCases({
    date,
    theatreId,
    surgeonUserId,
    patientId,
} = {}) {
    const params = toParams({
        date,
        theatre_id: theatreId,
        surgeon_user_id: surgeonUserId,
        patient_id: patientId,
    })
    return API.get('/ot/cases', { params })
}

export function getOtCase(caseId) {
    return API.get(`/ot/cases/${caseId}`)
}

export function createOtCase(data) {
    return API.post('/ot/cases', data)
}

export function updateOtCase(id, data) {
    return API.put(`/ot/cases/${id}`, data)
}

export function deleteOtCase(id) {
    return API.delete(`/ot/cases/${id}`)
}

// ---------- OPEN / CLOSE CASE FLOW ----------

export function openOtCaseForSchedule(scheduleId, data) {
    return API.post(`/ot/schedule/${scheduleId}/open-case`, data)
}

export function closeOtCase(caseId, data) {
    return API.post(`/ot/cases/${caseId}/close`, data)
}

// ============================================================
//  CLINICAL: PRE-ANAESTHESIA
// ============================================================

export function getPreAnaesthesia(caseId) {
    return API.get(`/ot/cases/${caseId}/pre-anaesthesia`)
}

export function createPreAnaesthesia(caseId, data) {
    // ensure case_id in body matches path
    return API.post(`/ot/cases/${caseId}/pre-anaesthesia`, {
        ...data,
        case_id: caseId,
    })
}

export function updatePreAnaesthesia(caseId, data) {
    return API.put(`/ot/cases/${caseId}/pre-anaesthesia`, data)
}

// ============================================================
//  CLINICAL: PRE-OP CHECKLIST
// ============================================================

export function getPreOpChecklist(caseId) {
    return API.get(`/ot/cases/${caseId}/preop-checklist`)
}

export function createPreOpChecklist(caseId, data) {
    return API.post(`/ot/cases/${caseId}/preop-checklist`, {
        ...data,
        case_id: caseId,
    })
}

export function updatePreOpChecklist(caseId, data) {
    return API.put(`/ot/cases/${caseId}/preop-checklist`, data)
}

// ============================================================
//  CLINICAL: SURGICAL SAFETY CHECKLIST
// ============================================================

export function getSafetyChecklist(caseId) {
    return API.get(`/ot/cases/${caseId}/safety-checklist`)
}

export function createSafetyChecklist(caseId, data) {
    return API.post(`/ot/cases/${caseId}/safety-checklist`, {
        ...data,
        case_id: caseId,
    })
}

export function updateSafetyChecklist(caseId, data) {
    return API.put(`/ot/cases/${caseId}/safety-checklist`, data)
}

// ============================================================
//  CLINICAL: ANAESTHESIA RECORD
// ============================================================

export function getAnaesthesiaRecord(caseId) {
    return API.get(`/ot/cases/${caseId}/anaesthesia-record`)
}

export function createAnaesthesiaRecord(caseId, data) {
    return API.post(`/ot/cases/${caseId}/anaesthesia-record`, {
        ...data,
        case_id: caseId,
    })
}

export function updateAnaesthesiaRecord(caseId, data) {
    return API.put(`/ot/cases/${caseId}/anaesthesia-record`, data)
}

// ----- Anaesthesia Vitals -----

export function listAnaesthesiaVitals(recordId) {
    return API.get(`/ot/anaesthesia-records/${recordId}/vitals`)
}

export function createAnaesthesiaVital(recordId, data) {
    return API.post(`/ot/anaesthesia-records/${recordId}/vitals`, {
        ...data,
        record_id: recordId,
    })
}

export function updateAnaesthesiaVital(vitalId, data) {
    return API.put(`/ot/anaesthesia-vitals/${vitalId}`, data)
}

export function deleteAnaesthesiaVital(vitalId) {
    return API.delete(`/ot/anaesthesia-vitals/${vitalId}`)
}

// ----- Anaesthesia Drugs -----

export function listAnaesthesiaDrugs(recordId) {
    return API.get(`/ot/anaesthesia-records/${recordId}/drugs`)
}

export function createAnaesthesiaDrug(recordId, data) {
    return API.post(`/ot/anaesthesia-records/${recordId}/drugs`, {
        ...data,
        record_id: recordId,
    })
}

export function updateAnaesthesiaDrug(drugId, data) {
    return API.put(`/ot/anaesthesia-drugs/${drugId}`, data)
}

export function deleteAnaesthesiaDrug(drugId) {
    return API.delete(`/ot/anaesthesia-drugs/${drugId}`)
}

// ============================================================
//  CLINICAL: NURSING RECORD
// ============================================================

export function getNursingRecord(caseId) {
    return API.get(`/ot/cases/${caseId}/nursing-record`)
}

export function createNursingRecord(caseId, data) {
    return API.post(`/ot/cases/${caseId}/nursing-record`, {
        ...data,
        case_id: caseId,
    })
}

export function updateNursingRecord(caseId, data) {
    return API.put(`/ot/cases/${caseId}/nursing-record`, data)
}

// ============================================================
//  CLINICAL: SPONGE & INSTRUMENT COUNT
// ============================================================

export function getCountsRecord(caseId) {
    return API.get(`/ot/cases/${caseId}/counts`)
}

export function createCountsRecord(caseId, data) {
    return API.post(`/ot/cases/${caseId}/counts`, {
        ...data,
        case_id: caseId,
    })
}

export function updateCountsRecord(caseId, data) {
    return API.put(`/ot/cases/${caseId}/counts`, data)
}

// ============================================================
//  CLINICAL: IMPLANTS / PROSTHESIS
// ============================================================

export function listImplants(caseId) {
    return API.get(`/ot/cases/${caseId}/implants`)
}

export function createImplant(caseId, data) {
    return API.post(`/ot/cases/${caseId}/implants`, {
        ...data,
        case_id: caseId,
    })
}

export function updateImplant(implantId, data) {
    return API.put(`/ot/implants/${implantId}`, data)
}

export function deleteImplant(implantId) {
    return API.delete(`/ot/implants/${implantId}`)
}

// ============================================================
//  CLINICAL: OPERATION NOTES
// ============================================================

export function getOperationNote(caseId) {
    return API.get(`/ot/cases/${caseId}/operation-note`)
}

export function createOperationNote(caseId, data) {
    return API.post(`/ot/cases/${caseId}/operation-note`, {
        ...data,
        case_id: caseId,
    })
}

export function updateOperationNote(caseId, data) {
    return API.put(`/ot/cases/${caseId}/operation-note`, data)
}

// ============================================================
//  CLINICAL: BLOOD TRANSFUSION (OT SIDE)
// ============================================================

export function listOtBloodTransfusions(caseId) {
    return API.get(`/ot/cases/${caseId}/blood-transfusions`)
}

export function createOtBloodTransfusion(caseId, data) {
    return API.post(`/ot/cases/${caseId}/blood-transfusions`, {
        ...data,
        case_id: caseId,
    })
}

export function updateOtBloodTransfusion(recordId, data) {
    return API.put(`/ot/blood-transfusions/${recordId}`, data)
}

export function deleteOtBloodTransfusion(recordId) {
    return API.delete(`/ot/blood-transfusions/${recordId}`)
}

// ============================================================
//  CLINICAL: PACU / RECOVERY
// ============================================================

export function getPacuRecord(caseId) {
    return API.get(`/ot/cases/${caseId}/pacu`)
}

export function createPacuRecord(caseId, data) {
    return API.post(`/ot/cases/${caseId}/pacu`, {
        ...data,
        case_id: caseId,
    })
}

export function updatePacuRecord(caseId, data) {
    return API.put(`/ot/cases/${caseId}/pacu`, data)
}

// ============================================================
//  ADMIN / LOGS: EQUIPMENT CHECKLIST
// ============================================================

export function listEquipmentChecklists({
    theatreId,
    date,
    fromDate,
    toDate,
    shift,
} = {}) {
    const params = toParams({
        theatre_id: theatreId,
        date,
        from_date: fromDate,
        to_date: toDate,
        shift,
    })
    return API.get('/ot/equipment-checklists', { params })
}

export function getEquipmentChecklist(id) {
    return API.get(`/ot/equipment-checklists/${id}`)
}

export function createEquipmentChecklist(data) {
    return API.post('/ot/equipment-checklists', data)
}

export function updateEquipmentChecklist(id, data) {
    return API.put(`/ot/equipment-checklists/${id}`, data)
}

export function deleteEquipmentChecklist(id) {
    return API.delete(`/ot/equipment-checklists/${id}`)
}

// ============================================================
//  ADMIN / LOGS: CLEANING / STERILITY LOG
// ============================================================

export function listCleaningLogs({
    theatreId,
    caseId,
    date,
    fromDate,
    toDate,
    session,
} = {}) {
    const params = toParams({
        theatre_id: theatreId,
        case_id: caseId,
        date,
        from_date: fromDate,
        to_date: toDate,
        session,
    })
    return API.get('/ot/cleaning-logs', { params })
}

export function getCleaningLog(id) {
    return API.get(`/ot/cleaning-logs/${id}`)
}

export function createCleaningLog(data) {
    return API.post('/ot/cleaning-logs', data)
}

export function updateCleaningLog(id, data) {
    return API.put(`/ot/cleaning-logs/${id}`, data)
}

export function deleteCleaningLog(id) {
    return API.delete(`/ot/cleaning-logs/${id}`)
}

// ============================================================
//  ADMIN / LOGS: ENVIRONMENT LOG (TEMP / HUMIDITY / PRESSURE)
// ============================================================

export function listEnvironmentLogs({
    theatreId,
    date,
    fromDate,
    toDate,
} = {}) {
    const params = toParams({
        theatre_id: theatreId,
        date,
        from_date: fromDate,
        to_date: toDate,
    })
    return API.get('/ot/environment-logs', { params })
}

export function getEnvironmentLog(id) {
    return API.get(`/ot/environment-logs/${id}`)
}

export function createEnvironmentLog(data) {
    return API.post('/ot/environment-logs', data)
}

export function updateEnvironmentLog(id, data) {
    return API.put(`/ot/environment-logs/${id}`, data)
}

export function deleteEnvironmentLog(id) {
    return API.delete(`/ot/environment-logs/${id}`)
}



// -------- Environment Params Masters (Temp/Humidity/Pressure limits etc.) --------

export function listOtEnvironmentParams() {
    return API.get('/ot/environment-params')
}

export function createOtEnvironmentParam(payload) {
    return API.post('/ot/environment-params', payload)
}

export function updateOtEnvironmentParam(id, payload) {
    return API.put(`/ot/environment-params/${id}`, payload)
}

export function deleteOtEnvironmentParam(id) {
    return API.delete(`/ot/environment-params/${id}`)
}

export function openOtCaseFromSchedule(scheduleId, payload = {}) {
    return API.post(`/ot/schedule/${scheduleId}/open-case`, payload)
}


// Optional: lock / cancel schedule
export function lockOtSchedule(id) {
    return API.post(`/ot/schedules/${id}/lock`)
}



// -------- Intra-op Nursing record --------

export function getIntraOpNursing(caseId) {
    return API.get(`/ot/cases/${caseId}/nursing`)
}

export function createIntraOpNursing(caseId, payload) {
    return API.post(`/ot/cases/${caseId}/nursing`, payload)
}

export function updateIntraOpNursing(caseId, payload) {
    return API.put(`/ot/cases/${caseId}/nursing`, payload)
}

// -------- Sponge / Instrument / Needle counts --------

export function getSpongeCount(caseId) {
    return API.get(`/ot/cases/${caseId}/counts`)
}

export function createSpongeCount(caseId, payload) {
    return API.post(`/ot/cases/${caseId}/counts`, payload)
}

export function updateSpongeCount(caseId, payload) {
    return API.put(`/ot/cases/${caseId}/counts`, payload)
}

// -------- Implants / Prosthesis --------







// -------- Blood transfusion (OT-side record) --------

export function listBloodTransfusions(caseId) {
    return API.get(`/ot/cases/${caseId}/transfusions`)
}

export function /* The above code is a comment in JavaScript. It is not performing any action or
functionality in the code. It is simply a way to add comments for documentation or
clarification purposes. */
    createBloodTransfusion(caseId, payload) {
    return API.post(`/ot/cases/${caseId}/transfusions`, payload)
}

export function updateBloodTransfusion(transfusionId, payload) {
    return API.put(`/ot/transfusions/${transfusionId}`, payload)
}

export function deleteBloodTransfusion(transfusionId) {
    return API.delete(`/ot/transfusions/${transfusionId}`)
}





