// frontend/src/components/emr/visitFormat.js
export const getVisitId = (v) => v?.visit_id ?? v?.id ?? null
export const getEpisodeId = (v) => v?.episode_id ?? ""
export const getVisitAt = (v) => v?.visit_at ?? v?.created_at ?? v?.date ?? null

export function fmtDateTime(iso) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}
