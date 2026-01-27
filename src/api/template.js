// FILE: frontend/src/api/template.js
// NUTRYAH EMR - Templates + Template Library + Meta (Departments/Record Types)
//
// This module intentionally hides backend response/unwrapping details.
// UI should only use `emrTemplatesClient.*` methods and handle simple errors (message).

import API from "./client"

/* -------------------- internal helpers -------------------- */

const extractErrMsg = (payload) => {
    if (!payload) return "Something went wrong"
    if (typeof payload === "string") return payload
    return (
        payload?.message ||
        payload?.error?.message ||
        payload?.error?.msg ||
        payload?.detail ||
        "Something went wrong"
    )
}

const unwrap = (res) => {
    const payload = res?.data

    // Backend style: { ok: true, data: ... }
    if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "ok")) {
        if (!payload.ok) throw new Error(extractErrMsg(payload))
        return payload.data
    }

    // Some endpoints may return raw arrays/objects directly
    return payload
}

const unwrapAxiosError = (e) => {
    const payload = e?.response?.data
    const msg = extractErrMsg(payload) || e?.message || "Request failed"
    throw new Error(msg)
}

const asBool = (v) => !!v
const normCode = (v) => String(v || "").trim().toUpperCase()

/* -------------------- tiny cache for bootstrap -------------------- */

let _bootCache = null
let _bootAt = 0
const BOOT_TTL_MS = 60_000

async function _bootstrap(force = false, signal) {
    const now = Date.now()
    if (!force && _bootCache && now - _bootAt < BOOT_TTL_MS) return _bootCache

    const data = await API.get("/emr/meta", { signal })
        .then(unwrap)
        .catch(unwrapAxiosError)

    const normalized = {
        departments: Array.isArray(data?.departments) ? data.departments : [],
        record_types: Array.isArray(data?.record_types) ? data.record_types : [],
        // optional in your backend meta
        presets: Array.isArray(data?.presets) ? data.presets : [],
    }

    _bootCache = normalized
    _bootAt = now
    return normalized
}

function _invalidateBoot() {
    _bootCache = null
    _bootAt = 0
}

/* -------------------- public client -------------------- */

export const emrTemplatesClient = {
    /* ---------- meta ---------- */
    bootstrap: (force = false, signal) => _bootstrap(force, signal),

    departmentsList: (params, signal) =>
        API.get("/emr/departments", { params: params || {}, signal }).then(unwrap).catch(unwrapAxiosError),

    departmentsCreate: async (payload, signal) => {
        const data = await API.post("/emr/departments", payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError)
        _invalidateBoot()
        return data
    },

    departmentsUpdate: async (dept_id, payload, signal) => {
        const data = await API.put(`/emr/departments/${dept_id}`, payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError)
        _invalidateBoot()
        return data
    },

    departmentsDelete: async (dept_id, signal) => {
        const data = await API.delete(`/emr/departments/${dept_id}`, { signal }).then(unwrap).catch(unwrapAxiosError)
        _invalidateBoot()
        return data
    },

    recordTypesList: (params, signal) =>
        API.get("/emr/record-types", { params: params || {}, signal }).then(unwrap).catch(unwrapAxiosError),

    recordTypesCreate: async (payload, signal) => {
        const data = await API.post("/emr/record-types", payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError)
        _invalidateBoot()
        return data
    },

    recordTypesUpdate: async (type_id, payload, signal) => {
        const data = await API.put(`/emr/record-types/${type_id}`, payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError)
        _invalidateBoot()
        return data
    },

    recordTypesDelete: async (type_id, signal) => {
        const data = await API.delete(`/emr/record-types/${type_id}`, { signal }).then(unwrap).catch(unwrapAxiosError)
        _invalidateBoot()
        return data
    },

    /* ---------- templates CRUD ---------- */
    templatesList: (params, signal) =>
        API.get("/emr/templates", { params: params || {}, signal }).then(unwrap).catch(unwrapAxiosError),

    templateGet: (template_id, signal) =>
        API.get(`/emr/templates/${template_id}`, { signal }).then(unwrap).catch(unwrapAxiosError),

    templateCreate: (payload, signal) =>
        API.post("/emr/templates", payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    templateUpdateMeta: (template_id, payload, signal) =>
        API.put(`/emr/templates/${template_id}`, payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    templateCreateVersion: (template_id, payload, signal) =>
        API.post(`/emr/templates/${template_id}/versions`, payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    templatePublishToggle: (template_id, publish = true, signal) =>
        API.post(`/emr/templates/${template_id}/publish`, { publish: asBool(publish) }, { signal })
            .then(unwrap)
            .catch(unwrapAxiosError),

    /* ---------- schema tools ---------- */
    validateSchema: (payload, signal) =>
        API.post("/emr/templates/validate", payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    previewSchema: (payload, signal) =>
        API.post("/emr/templates/preview", payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    // New: server-side normalization + stable hash (used by the Visual Builder)
    // Safe to call even if backend doesn't implement yet; UI falls back to client normalization.
    normalizeSchema: (payload, signal) =>
        API.post("/emr/templates/normalize", payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    hashSchema: (payload, signal) =>
        API.post("/emr/templates/hash", payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    // New: Builder meta (field types, clinical concepts, validation presets)
    builderMeta: (params, signal) =>
        API.get("/emr/templates/builder/meta", { params: params || {}, signal }).then(unwrap).catch(unwrapAxiosError),

    presets: ({ dept_code, record_type_code }, signal) =>
        API.get("/emr/templates/presets", {
            params: { dept_code: normCode(dept_code), record_type_code: normCode(record_type_code) },
            signal,
        })
            .then(unwrap)
            .catch(unwrapAxiosError),

    suggest: ({ dept_code, record_type_code }, signal) =>
        API.get("/emr/templates/suggest", {
            params: { dept_code: normCode(dept_code), record_type_code: normCode(record_type_code) },
            signal,
        })
            .then(unwrap)
            .catch(unwrapAxiosError),

    /* ---------- section library (clinician-friendly titles) ---------- */
    sectionLibraryList: (params, signal) =>
        API.get("/emr/sections/library", { params: params || {}, signal }).then(unwrap).catch(unwrapAxiosError),

    sectionLibraryCreate: (payload, signal) =>
        API.post("/emr/sections/library", payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    sectionLibraryUpdate: (section_id, payload, signal) =>
        API.put(`/emr/sections/library/${section_id}`, payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    /* ---------- blocks library (reusable schema blocks) ---------- */
    blocksList: (params, signal) =>
        API.get("/emr/blocks/library", { params: params || {}, signal }).then(unwrap).catch(unwrapAxiosError),

    blocksCreate: (payload, signal) =>
        API.post("/emr/blocks/library", payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    blocksUpdate: (block_id, payload, signal) =>
        API.put(`/emr/blocks/library/${block_id}`, payload || {}, { signal }).then(unwrap).catch(unwrapAxiosError),

    blocksDelete: (block_id, signal) =>
        API.delete(`/emr/blocks/library/${block_id}`, { signal }).then(unwrap).catch(unwrapAxiosError),

    /* ---------- patient encounters helper ---------- */
    patientEncounters: ({ patient_id, limit = 100 }, signal) =>
        API.get(`/emr/patients/${patient_id}/encounters`, { params: { limit }, signal }).then(unwrap).catch(unwrapAxiosError),
}