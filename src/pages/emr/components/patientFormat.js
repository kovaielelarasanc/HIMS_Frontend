// frontend/src/components/emr/patientFormat.js
export const patientFullName = (p) =>
    [p?.prefix, p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || "—"

export const patientDobText = (p) => (p?.dob ? String(p.dob).slice(0, 10) : "—")

export const patientAgeText = (p) => p?.age_short_text || p?.age_text || ""

export const patientPrimaryMeta = (p) => {
    const uhid = p?.uhid || "—"
    const phone = p?.phone || "—"
    const age = patientAgeText(p)
    const gender = p?.gender || ""
    const bits = [
        `UHID: ${uhid}`,
        `Phone: ${phone}`,
        age ? `Age: ${age}` : null,
        gender ? `Gender: ${gender}` : null,
    ].filter(Boolean)
    return bits.join(" • ")
}
