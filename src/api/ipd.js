// src/api/ipd.js
import API from './client'

/* =========================
   IPD MASTERS (Ward/Room/Bed/Package/Rate)
   ========================= */
export const listWards = () => API.get('/ipd/wards')
export const createWard = (payload) => API.post('/ipd/wards', payload)
export const updateWard = (id, payload) => API.put(`/ipd/wards/${id}`, payload)
export const deleteWard = (id) => API.delete(`/ipd/wards/${id}`)

export const listRooms = (params = {}) => API.get('/ipd/rooms', { params })        // e.g. { ward_id }
export const createRoom = (payload) => API.post('/ipd/rooms', payload)
export const updateRoom = (id, payload) => API.put(`/ipd/rooms/${id}`, payload)
export const deleteRoom = (id) => API.delete(`/ipd/rooms/${id}`)

export const listBeds = (params = {}) => API.get('/ipd/beds', { params })         // e.g. { room_id }
export const createBed = (payload) => API.post('/ipd/beds', payload)
export const updateBed = (id, payload) => API.put(`/ipd/beds/${id}`, payload)
export const deleteBed = (id) => API.delete(`/ipd/beds/${id}`)
// quick state change: { state: 'reserved'|'preoccupied'|'vacant'|'occupied', reserved_until?, note? }
export const setBedState = (id, payload) => API.patch(`/ipd/beds/${id}/state`, payload)

export const listPackages = () => API.get('/ipd/packages')
export const createPackage = (payload) => API.post('/ipd/packages', payload)
export const updatePackage = (id, payload) => API.put(`/ipd/packages/${id}`, payload)
export const deletePackage = (id) => API.delete(`/ipd/packages/${id}`)

export const listBedRates = () => API.get('/ipd/bed-rates')
export const createBedRate = (payload) => API.post('/ipd/bed-rates', payload)
export const updateBedRate = (id, payload) => API.put(`/ipd/bed-rates/${id}`, payload)
export const deleteBedRate = (id) => API.delete(`/ipd/bed-rates/${id}`)

/* =========================
   ADMISSIONS
   ========================= */
export const listAdmissions = (params = {}) => API.get('/ipd/admissions', { params })
export const createAdmission = (payload) => API.post('/ipd/admissions', payload)

// robust read-by-id with fallbacks
export const getAdmission = async (id) => {
    try {
        return await API.get(`/ipd/admissions/${id}`)
    } catch (e1) {
        const s1 = e1?.response?.status
        if (s1 === 404 || s1 === 405) {
            try {
                return await API.get(`/ipd/admission/${id}`)
            } catch (e2) {
                const s2 = e2?.response?.status
                if (s2 === 404 || s2 === 405) {
                    const { data: list = [] } = await API.get('/ipd/admissions', { params: { limit: 500 } })
                    const found = (list || []).find(a => Number(a?.id) === Number(id))
                    if (!found) { const err = new Error('Not found'); err.status = 404; throw err }
                    return { data: found }
                }
                throw e2
            }
        }
        throw e1
    }
}

export const updateAdmission = (id, payload) => API.put(`/ipd/admissions/${id}`, payload)
export const cancelAdmission = (id) => API.patch(`/ipd/admissions/${id}/cancel`)
export const transferBed = (id, payload) => API.post(`/ipd/admissions/${id}/transfer`, payload)

/* =========================
   NURSING / CLINICAL
   ========================= */
// Nursing notes
export const listNursingNotes = (admission_id) => API.get(`/ipd/admissions/${admission_id}/nursing-notes`)
export const addNursingNote = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/nursing-notes`, payload)

// Vitals
export const listVitals = (admission_id) => API.get(`/ipd/admissions/${admission_id}/vitals`)
export const addVital = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/vitals`, payload)

// Intake / Output
export const listIO = (admission_id) => API.get(`/ipd/admissions/${admission_id}/io`)
export const addIO = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/io`, payload)

// Shift Handover
export const listHandovers = (admission_id) => API.get(`/ipd/admissions/${admission_id}/shift-handovers`)
export const addHandover = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/shift-handovers`, payload)

// Rounds
export const listRounds = (admission_id) => API.get(`/ipd/admissions/${admission_id}/rounds`)
export const addRound = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/rounds`, payload)

// Progress Notes
export const listProgress = (admission_id) => API.get(`/ipd/admissions/${admission_id}/progress-notes`)
export const addProgress = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/progress-notes`, payload)

// Referrals
export const listReferrals = (admission_id) => API.get(`/ipd/admissions/${admission_id}/referrals`)
export const addReferral = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/referrals`, payload)

/* =========================
   DISCHARGE
   ========================= */
export const getDischargeSummary = (admission_id) => API.get(`/ipd/admissions/${admission_id}/discharge-summary`)
export const saveDischargeSummary = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/discharge-summary`, payload)

export const getDischargeChecklist = (admission_id) => API.get(`/ipd/admissions/${admission_id}/discharge-checklist`)
export const saveDischargeChecklist = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/discharge-checklist`, payload)

export const listDueDischarges = (dateISO) => API.get('/ipd/discharge/due', { params: { date: dateISO } })

/* =========================
   OT / ANAESTHESIA
   ========================= */
export const listOtCases = (admission_id) => API.get(`/ipd/admissions/${admission_id}/ot-cases`)
export const addOtCase = (admission_id, payload) => API.post(`/ipd/admissions/${admission_id}/ot-cases`, payload)
export const updateOtCase = (ot_case_id, payload) => API.put(`/ipd/ot-cases/${ot_case_id}`, payload)

export const getAnaesthesia = (ot_case_id) => API.get(`/ipd/ot-cases/${ot_case_id}/anaesthesia`)
export const saveAnaesthesia = (payload) => API.post('/ipd/anaesthesia', payload)

/* =========================
   BED CHARGES PREVIEW
   ========================= */
// params: { from_date?: 'YYYY-MM-DD', to_date?: 'YYYY-MM-DD' }
export const previewBedCharges = (admission_id, params = {}) =>
    API.get('/ipd/bed-charges/preview', { params: { admission_id, ...params } })

/* =========================
   PATIENT (display helpers)
   ========================= */
export const getPatient = (id) => API.get(`/patients/${id}`)

/* =========================
   BACKWARD-COMPAT ALIASES
   (so legacy tabs/components don't break)
   ========================= */
// Nursing
export const createNursingNote = (...args) => addNursingNote(...args)
export const getNursingNotes = (...args) => listNursingNotes(...args)

// Vitals (singular & plural)
export const createVital = (...args) => addVital(...args)
export const createVitals = (...args) => addVital(...args)    // <-- for components importing 'createVitals'
export const getVitals = (...args) => listVitals(...args)

// Intake/Output
export const createIntakeOutput = (...args) => addIO(...args)
export const getIntakeOutput = (...args) => listIO(...args)

// Shift Handover
export const createShiftHandover = (...args) => addHandover(...args)
export const getShiftHandovers = (...args) => listHandovers(...args)

// Doctor Rounds
export const createDoctorRound = (...args) => addRound(...args)
export const getDoctorRounds = (...args) => listRounds(...args)

// Progress Notes
export const createProgressNote = (...args) => addProgress(...args)
export const getProgressNotes = (...args) => listProgress(...args)

// Referrals
export const createReferral = (...args) => addReferral(...args)
export const getReferrals = (...args) => listReferrals(...args)
