// FILE: src/api/ipd.js
import API from './client'

/* =========================================================
   Helpers
   ========================================================= */
const toParams = (obj = {}) => {
  const out = {}
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  })
  return out
}

/* =========================================================
   IPD MASTERS (Ward / Room / Bed / Package / Bed Rates)
   ========================================================= */

// Wards
export const listWards = () => API.get('/ipd/wards')
export const createWard = (payload) => API.post('/ipd/wards', payload)
export const updateWard = (id, payload) => API.put(`/ipd/wards/${id}`, payload)
export const deleteWard = (id) => API.delete(`/ipd/wards/${id}`)

// Rooms (params example: { ward_id })
export const listRooms = (params = {}) =>
  API.get('/ipd/rooms', { params: toParams(params) })
export const createRoom = (payload) => API.post('/ipd/rooms', payload)
export const updateRoom = (id, payload) => API.put(`/ipd/rooms/${id}`, payload)
export const deleteRoom = (id) => API.delete(`/ipd/rooms/${id}`)

// Beds (params example: { room_id, ward_id })
export const listBeds = (params = {}) =>
  API.get('/ipd/beds', { params: toParams(params) })
export const createBed = (payload) => API.post('/ipd/beds', payload)
export const updateBed = (id, payload) => API.put(`/ipd/beds/${id}`, payload)
export const deleteBed = (id) => API.delete(`/ipd/beds/${id}`)

/**
 * Quick bed state change
 * payload: { state: 'vacant' | 'reserved' | 'preoccupied', reserved_until?, note? }
 * NOTE: backend expects query params, not JSON body.
 */
export const setBedState = (id, payload) =>
  API.patch(`/ipd/beds/${id}/state`, null, { params: toParams(payload) })

// Bedboard snapshot + tree
export const getBedboard = (params = {}) =>
  API.get('/ipd/bedboard', { params: toParams(params) }) // optional { ward_id }

export const moveBed = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/move-bed`, payload)

export const getWardRoomBedTree = (params = {}) =>
  API.get('/ipd/tree', { params: toParams(params) }) // { only_active?: boolean }

// Packages
export const listPackages = () => API.get('/ipd/packages')
export const createPackage = (payload) => API.post('/ipd/packages', payload)
export const updatePackage = (id, payload) =>
  API.put(`/ipd/packages/${id}`, payload)
export const deletePackage = (id) => API.delete(`/ipd/packages/${id}`)

// Bed Rates (params example: { room_type })
export const listBedRates = (params = {}) =>
  API.get('/ipd/bed-rates', { params: toParams(params) })
export const createBedRate = (payload) => API.post('/ipd/bed-rates', payload)
export const updateBedRate = (id, payload) =>
  API.put(`/ipd/bed-rates/${id}`, payload)
export const deleteBedRate = (id) => API.delete(`/ipd/bed-rates/${id}`)

export const resolveBedRate = (room_type, on_date) =>
  API.get('/ipd/bed-rates/resolve', {
    params: { room_type, on_date },
  })

/* =========================================================
   ADMISSIONS
   ========================================================= */

// List IPD admissions
export const listAdmissions = (params = {}) =>
  API.get('/ipd/admissions', { params: toParams(params) })

// Create new admission
export const createAdmission = (payload) => API.post('/ipd/admissions', payload)

// Robust read-by-id with fallbacks
export const getAdmission = async (id) => {
  try {
    return await API.get(`/ipd/admissions/${id}`)
  } catch (e1) {
    const s1 = e1?.response?.status
    if (s1 === 404 || s1 === 405) {
      try {
        // legacy singular URL if ever used
        return await API.get(`/ipd/admission/${id}`)
      } catch (e2) {
        const s2 = e2?.response?.status
        if (s2 === 404 || s2 === 405) {
          const { data: list = [] } = await API.get('/ipd/admissions', {
            params: { limit: 500 },
          })
          const found = (list || []).find((a) => Number(a?.id) === Number(id))
          if (!found) {
            const err = new Error('Not found')
            err.status = 404
            throw err
          }
          return { data: found }
        }
        throw e2
      }
    }
    throw e1
  }
}

export const updateAdmission = (id, payload) =>
  API.put(`/ipd/admissions/${id}`, payload)

export const cancelAdmission = (id) =>
  API.patch(`/ipd/admissions/${id}/cancel`)

// Bed transfer
const unwrap = (res) => {
  const payload = res?.data
  if (!payload?.status) {
    const msg = payload?.error?.msg || 'Something went wrong'
    throw new Error(msg)
  }
  return payload.data
}

export const listTransfers = async (admissionId) => unwrap(await API.get(`/ipd/admissions/${admissionId}/transfers`))
export const requestTransfer = async (admissionId, payload) => unwrap(await API.post(`/ipd/admissions/${admissionId}/transfers`, payload))
export const approveTransfer = async (transferId, payload) => unwrap(await API.post(`/ipd/transfers/${transferId}/approve`, payload))
export const assignTransferBed = async (transferId, payload) => unwrap(await API.post(`/ipd/transfers/${transferId}/assign`, payload))
export const completeTransfer = async (transferId, payload) => unwrap(await API.post(`/ipd/transfers/${transferId}/complete`, payload))
export const cancelTransfer = async (transferId, payload) => unwrap(await API.post(`/ipd/transfers/${transferId}/cancel`, payload))

// My admissions (for logged-in doctor / nurse)
export const listMyIpdAdmissions = (filters = {}) =>
  API.get('/ipd/my-admissions', { params: toParams(filters) })

// Tracking admissions list (for IPD coordinator)
export const listTrackingAdmissions = (filters = {}) =>
  API.get('/ipd/tracking-admissions', { params: toParams(filters) })

// Discharged list
export const listDischargedAdmissions = (filters = {}) =>
  API.get('/ipd/discharged', { params: toParams(filters) })

/**
 * Mark special status: 'lama' | 'dama' | 'disappeared'
 */
export const markAdmissionSpecialStatus = (id, status) =>
  API.patch(`/ipd/admissions/${id}/mark-status`, null, {
    params: { status },
  })

/* =========================================================
   NURSING / CLINICAL
   ========================================================= */
// Nursing notes
export const listNursingNotes = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/nursing-notes`)

export const addNursingNote = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/nursing-notes`, payload)

// Latest vitals snapshot for an admission
export const getLatestVitals = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/vitals/latest`)



// Vitals
export const listVitals = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/vitals`)
export const addVital = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/vitals`, payload)

// Intake / Output
export const listIO = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/io`)
export const addIO = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/io`, payload)

// Shift Handover
export const listHandovers = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/shift-handovers`)
export const addHandover = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/shift-handovers`, payload)

// Rounds
export const listRounds = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/rounds`)
export const addRound = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/rounds`, payload)

// Progress Notes
export const listProgress = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/progress-notes`)
export const addProgress = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/progress-notes`, payload)

// Referrals
export const listReferrals = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/referrals`)
export const addReferral = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/referrals`, payload)

/* =========================================================
   ASSESSMENTS (Pain / Fall / Pressure / Nutrition)
   ========================================================= */

// Pain
export const listPainAssessments = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/assessments/pain`)
export const addPainAssessment = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/assessments/pain`, payload)

// Fall Risk
export const listFallRiskAssessments = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/assessments/fall-risk`)
export const addFallRiskAssessment = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/assessments/fall-risk`, payload)

// Pressure Ulcer
export const listPressureUlcerAssessments = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/assessments/pressure-ulcer`)
export const addPressureUlcerAssessment = (admission_id, payload) =>
  API.post(
    `/ipd/admissions/${admission_id}/assessments/pressure-ulcer`,
    payload
  )

// Nutrition
export const listNutritionAssessments = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/assessments/nutrition`)
export const addNutritionAssessment = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/assessments/nutrition`, payload)

// Generic assessments (if you use a generic screen)
export const listAssessments = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/assessments`)

export const addAssessment = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/assessments`, payload)

/* =========================================================
   GENERIC IPD ORDERS
   ========================================================= */

export const listIpdOrders = (admission_id, params = {}) =>
  API.get(`/ipd/admissions/${admission_id}/orders`, {
    params: toParams(params), // { order_type?, status? }
  })

export const addIpdOrder = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/orders`, payload)

/* =========================================================
   Medications (Drug chart)
   ========================================================= */

// ---------------- IPD MEDICATIONS (ORDERS) ----------------

export const listMedications = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/medications-order`)

export const addMedication = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/medications-order`, payload)

// Backend route: PUT /ipd/medications/{order_id}
export const updateMedication = (order_id, payload) =>
  API.put(`/ipd/medications-order/${order_id}`, payload)

// ---------------- DRUG CHART META (HEADER) ----------------

export const getDrugChartMeta = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/drug-chart/meta`)

export const saveDrugChartMeta = (admission_id, payload) =>
  API.put(`/ipd/admissions/${admission_id}/drug-chart/meta`, payload)

// ---------------- IV FLUID ORDERS ----------------

export const listIvFluids = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/drug-chart/iv-fluids`)

export const addIvFluid = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/drug-chart/iv-fluids`, payload)

export const updateIvFluid = (iv_id, payload) =>
  API.put(`/ipd/drug-chart/iv-fluids/${iv_id}`, payload)

export const deleteIvFluid = (iv_id) =>
  API.delete(`/ipd/iv-fluids/${iv_id}`)

// ---------------- NURSE SIGNATURE ROWS ----------------

export const listDrugChartNurses = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/drug-chart/nurses`)

export const addDrugChartNurse = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/drug-chart/nurses`, payload)

export const deleteDrugChartNurse = (row_id) =>
  API.delete(`/ipd/drug-chart/nurses/${row_id}`)

// ---------------- DOCTOR DAILY AUTHORISATION ----------------

export const listDoctorAuths = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/drug-chart/doctor-auth`)

export const addDoctorAuth = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/drug-chart/doctor-auth`, payload)

export const deleteDoctorAuth = (auth_id) =>
  API.delete(`/ipd/drug-chart/doctor-auth/${auth_id}`)

// ---------------- DRUG CHART PDF (OPTIONAL) ----------------

export const downloadDrugChartPdf = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/drug-chart/pdf`, {
    responseType: 'blob',
  })

// Regenerate Drug Chart rows after change
export const regenerateMedicationAdministration = (
  med_id,
  clear_existing = true
) =>
  API.post(`/ipd/medications/${med_id}/regenerate-admin`, null, {
    params: { clear_existing },
  })

// Drug Chart list
export const listDrugChart = (admission_id, params = {}) =>
  API.get(`/ipd/admissions/${admission_id}/drug-chart`, {
    params: toParams(params), // { from_datetime?, to_datetime? }
  })

// Mark a single Drug Chart entry (given/missed/refused/held/pending)
export const markDrugChartEntry = (admin_id, status_value, remarks) =>
  API.post(`/ipd/drug-chart/${admin_id}/mark`, null, {
    params: toParams({ status_value, remarks }),
  })

/* =========================================================
   Dressing / Transfusion / Restraint / Isolation / ICU
   ========================================================= */

// Dressing records
export const listDressingRecords = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/dressing-records`)
export const addDressingRecord = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/dressing-records`, payload)

// Blood transfusions
export const listTransfusions = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/transfusions`)
export const addTransfusion = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/transfusions`, payload)

// Restraints
export const listRestraints = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/restraints`)
export const addRestraint = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/restraints`, payload)

// Isolation
export const listIsolationRecords = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/isolation`)
export const addIsolationRecord = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/isolation`, payload)

// ICU Flow sheet
export const listIcuFlowSheets = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/icu-flow`)
export const addIcuFlowSheet = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/icu-flow`, payload)

/* =========================================================
   DISCHARGE (Summary / Checklist / Medications / Due List)
   ========================================================= */

// ---------- Discharge Summary ----------

export const getDischargeSummary = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/discharge-summary`)

export const saveDischargeSummary = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/discharge-summary`, payload)

/**
 * Push discharge summary to ABHA (stub)
 */
export const pushDischargeToAbha = (admission_id) =>
  API.post(`/ipd/admissions/${admission_id}/push-to-abha`)

// ---------- Discharge Checklist ----------

export const getDischargeChecklist = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/discharge-checklist`)

export const saveDischargeChecklist = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/discharge-checklist`, payload)

// ---------- Discharge queue (due discharges) ----------
// Backend route: GET /ipd/due-discharges?for_date=YYYY-MM-DD
export const listDueDischarges = (for_date) =>
  API.get('/ipd/due-discharges', { params: { for_date } })

// ---------- Structured Discharge Medications (new table) ----------

export const listDischargeMedications = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/discharge-medications`)

export const addDischargeMedication = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/discharge-medications`, payload)

export const deleteDischargeMedication = (admission_id, med_id) =>
  API.delete(`/ipd/admissions/${admission_id}/discharge-medications/${med_id}`)

// ---------- Older "summary text" style discharge meds (if used) ----------

export const listDischargeMeds = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/discharge-meds`)

export const saveDischargeMeds = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/discharge-meds`, payload)

// Follow-up dropdown options
export const listAdmissionFollowups = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/followups`)

/* =========================================================
   OT / ANAESTHESIA (linked to IPD)
   ========================================================= */

// OT cases linked to admission
export const listOtCases = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/ot-cases`)

export const addOtCase = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/ot-cases`, payload)

// OT cases generic list (filters: admission_id, status)
export const listAllOtCases = (params = {}) =>
  API.get('/ipd/ot/cases', { params: toParams(params) })

// Update only status
export const updateOtCaseStatus = (ot_case_id, status) =>
  API.patch(`/ipd/ot/cases/${ot_case_id}/status`, null, {
    params: { status },
  })

// Update OT time log (actual_start / actual_end)
export const updateOtTimeLog = (ot_case_id, params = {}) =>
  API.patch(`/ipd/ot/cases/${ot_case_id}/time-log`, null, {
    params: toParams(params), // { actual_start?, actual_end? }
  })

// Anaesthesia records for case
export const getAnaesthesia = (ot_case_id) =>
  API.get(`/ipd/ot-cases/${ot_case_id}/anaesthesia`)

// Create new anaesthesia record (backend has /ipd/anaesthesia alias)
export const saveAnaesthesia = (payload) => API.post('/ipd/anaesthesia', payload)

/* =========================================================
   BED CHARGES PREVIEW
   ========================================================= */

// params: { from_date?: 'YYYY-MM-DD', to_date?: 'YYYY-MM-DD' }
export const previewBedCharges = (admission_id, params = {}) =>
  API.get('/ipd/bed-charges/preview', {
    params: { admission_id, ...toParams(params) },
  })

/* =========================================================
   IPD FEEDBACK
   ========================================================= */

export const getAdmissionFeedback = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/feedback`)

export const saveAdmissionFeedback = (admission_id, payload) =>
  API.post(`/ipd/admissions/${admission_id}/feedback`, payload)

/* =========================================================
   CLINICAL NOTES
   ========================================================= */

// Clinical Notes
export const getClinicalNotes = (admission_id) =>
  API.get(`/ipd/admissions/${admission_id}/clinical-notes`)

export const updateClinicalNotes = (admission_id, payload) =>
  API.patch(`/ipd/admissions/${admission_id}/clinical-notes`, payload)

/* =========================================================
   PATIENT (display helpers)
   ========================================================= */

export const getPatient = (id) => API.get(`/patients/${id}`)

/* =========================================================
   BACKWARD-COMPAT ALIASES
   (so legacy tabs/components don't break – no duplicate logic)
   ========================================================= */

// Masters aliases
export const listIpdWards = () => listWards()
export const listIpdRooms = (ward_id) => listRooms({ ward_id })
export const listIpdBeds = (filters = {}) => listBeds(filters)
export const listIpdPackages = () => listPackages()

// Admissions aliases
export const listIpdAdmissions = (filters = {}) => listAdmissions(filters)
export const getIpdAdmission = (id) => getAdmission(id)
export const createIpdAdmission = (payload) => createAdmission(payload)
export const updateIpdAdmission = (id, payload) => updateAdmission(id, payload)
export const markAdmissionStatus = (id, status) =>
  markAdmissionSpecialStatus(id, status)

// Nursing aliases
export const createNursingNote = (...args) => addNursingNote(...args)
export const getNursingNotes = (...args) => listNursingNotes(...args)

// Vitals
export const createVital = (...args) => addVital(...args)
export const createVitals = (...args) => addVital(...args)
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

// Feedback aliases
export const listIpdFeedback = (admission_id) =>
  getAdmissionFeedback(admission_id)
export const addIpdFeedback = (admission_id, payload) =>
  saveAdmissionFeedback(admission_id, payload)



// export const addDressingTransfusion = (admission_id, payload) =>
//   API.post(`/ipd/admissions/${admission_id}/dressing-transfusion`)

// export const listDressingTransfusions = (admission_id) => API.get(`/ipd/admissions/${admission_id}/dressing-transfusion`)