// FILE: src/api/ipdNewborn.js
import API from "./client";

const unwrap = (res) => {
    const payload = res?.data;
    if (!payload?.status) {
        const msg = payload?.error?.msg || payload?.error?.message || "Something went wrong";
        throw new Error(msg);
    }
    return payload.data;
};

export const getNewbornResuscitation = (admissionId) =>
    API.get(`/ipd/admissions/${admissionId}/newborn/resuscitation`).then(unwrap);

export const createNewbornResuscitation = (admissionId, payload) =>
    API.post(`/ipd/admissions/${admissionId}/newborn/resuscitation`, {
        admission_id: admissionId,
        ...(payload || {}),
    }).then(unwrap);

export const updateNewbornResuscitation = (admissionId, payload) =>
    API.patch(`/ipd/admissions/${admissionId}/newborn/resuscitation`, payload || {}).then(unwrap);

export const verifyNewbornResuscitation = (admissionId, note) =>
    API.post(`/ipd/admissions/${admissionId}/newborn/resuscitation/verify`, { note: note || "" }).then(unwrap);

export const finalizeNewbornResuscitation = (admissionId, note) =>
    API.post(`/ipd/admissions/${admissionId}/newborn/resuscitation/finalize`, { note: note || "" }).then(unwrap);

export const voidNewbornResuscitation = (admissionId, reason) =>
    API.post(`/ipd/admissions/${admissionId}/newborn/resuscitation/void`, { reason }).then(unwrap);

export const printNewbornResuscitationPdfUrl = (admissionId) =>
    `${API.defaults.baseURL || ""}/ipd/admissions/${admissionId}/newborn/resuscitation/print.pdf`;

export const fetchNewbornResuscitationPdf = (admissionId) =>
    API.get(`/ipd/admissions/${admissionId}/newborn/resuscitation/print.pdf`, {
        responseType: "blob",
    }).then((res) => res.data);