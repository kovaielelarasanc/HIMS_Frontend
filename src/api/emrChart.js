// FILE: frontend/src/api/emrChart.js

import { unwrapApi } from "./_unwrap";
import API from "./client"; // <-- IMPORTANT: keep same axios instance you already use


/**
 * Backend routes (based on your uploaded routes_emr_all.py):
 * - GET  /emr/patients/{patient_id}/chart
 * - GET  /emr/records/{record_id}
 */

export async function getPatientChart(patientId, params = {}, signal) {
  const res = await API.get(`/emr/patients/${patientId}/chart`, {
    params,
    signal,
  })
  return unwrapApi(res.data)
}

export async function getEmrRecord(recordId, signal) {
  const res = await API.get(`/emr/records/${recordId}`, { signal })
  return unwrapApi(res.data)
}
