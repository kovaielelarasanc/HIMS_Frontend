// FILE: src/api/creditMasters.js
import API from "./client";

// -------- Payers --------

export function listPayers() {
    return API.get("/billing/payers");
}

export function createPayer(payload) {
    return API.post("/billing/payers", payload);
}

export function updatePayer(id, payload) {
    return API.put(`/billing/payers/${id}`, payload);
}

export function deletePayer(id) {
    return API.delete(`/billing/payers/${id}`);
}

// -------- TPAs --------

export function listTpas() {
    return API.get("/billing/tpas");
}

export function createTpa(payload) {
    return API.post("/billing/tpas", payload);
}

export function updateTpa(id, payload) {
    return API.put(`/billing/tpas/${id}`, payload);
}

export function deleteTpa(id) {
    return API.delete(`/billing/tpas/${id}`);
}

// -------- Credit Plans --------

export function listCreditPlans() {
    return API.get("/billing/credit-plans");
}

export function createCreditPlan(payload) {
    return API.post("/billing/credit-plans", payload);
}

export function updateCreditPlan(id, payload) {
    return API.put(`/billing/credit-plans/${id}`, payload);
}

export function deleteCreditPlan(id) {
    return API.delete(`/billing/credit-plans/${id}`);
}

// -------- Credit Providers --------

export function listCreditProviders() {
    return API.get("/billing/credit-providers");
}

export function createCreditProvider(payload) {
    return API.post("/billing/credit-providers", payload);
}

export function updateCreditProvider(id, payload) {
    return API.put(`/billing/credit-providers/${id}`, payload);
}

export function deleteCreditProvider(id) {
    return API.delete(`/billing/credit-providers/${id}`);
}
