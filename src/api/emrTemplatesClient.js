import API from "./client"

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

// Optional helper: normalize axios thrown errors into message
const unwrapAxiosError = (e) => {
    const payload = e?.response?.data
    const msg = extractErrMsg(payload) || e?.message || "Request failed"
    throw new Error(msg)
}


export const emrTemplatesClient = {

    validateSchema: (payload) =>
        API.post("/emr/templates/validate", { body: payload })
            .then(unwrap)
            .catch(unwrapAxiosError),
    previewSchema: (payload, signal) =>
        API.post("/emr/templates/preview", payload || {}, { signal })
            .then(unwrap)
            .catch(unwrapAxiosError),

    presets: ({ dept_code, record_type_code }) =>
        API.get("/emr/templates/presets", {
            params: { dept_code, record_type_code },
        })
            .then(unwrap)
            .catch(unwrapAxiosError),

    suggest: ({ dept_code, record_type_code }) =>
        API.get("/emr/templates/suggest", {
            params: { dept_code, record_type_code },
        })
            .then(unwrap)
            .catch(unwrapAxiosError),

    sectionLibraryList: (params) =>
        API.get("/emr/section-library", { params })
            .then(unwrap)
            .catch(unwrapAxiosError),

    blocksList: (params) =>
        API.get("/emr/blocks", { params })
            .then(unwrap)
            .catch(unwrapAxiosError),

    patientEncounters: ({ patient_id, limit = 100 }) =>
        API.get(`/emr/patients/${patient_id}/encounters`, {
            params: { limit },
        })
            .then(unwrap)
            .catch(unwrapAxiosError),
};

