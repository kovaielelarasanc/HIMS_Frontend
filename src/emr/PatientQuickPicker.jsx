// frontend/src/emr/PatientQuickPicker.jsx
import { useEffect, useMemo, useState } from 'react'
import { lookupPatients, exportEmrPdfJson, exportEmrPdfMultipart } from '../api/emr'
import { Search } from 'lucide-react'

import { toast } from 'sonner'

export default function PatientQuickPicker({ onPick, placeholder = "UHID, name, phone, email…" }) {
    const [q, setQ] = useState('')
    const [list, setList] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let alive = true
        const run = async () => {
            if (!q || !q.trim()) { setList([]); return }
            try {
                setLoading(true)
                const { data } = await lookupPatients(q.trim())
                if (!alive) return
                setList(data?.results || [])
            } finally {
                setLoading(false)
            }
        }
        const id = setTimeout(run, 250) // debounce
        return () => { alive = false; clearTimeout(id) }
    }, [q])

    const show = useMemo(() => list.slice(0, 8), [list])


    async function onExport(patient, range, sections) {
        try {
            const base = patient?.id ? { patient_id: patient.id } : { uhid: patient.uhid }
            const payload = {
                ...base,
                date_from: range?.from || undefined,
                date_to: range?.to || undefined,
                sections,                 // {opd:true, ipd:false, ...}
                consent_required: false,  // ✅ bypass for now
            }

            const { data: blob } = await exportEmrPdfJson(payload)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `EMR_${patient.uhid || patient.id}.pdf`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('PDF exported')
        } catch (err) {
            if (err?.response?.status === 412) {
                toast.error('Consent required for export. Disable consent or capture a consent.')
            } else {
                toast.error('PDF export failed')
            }
        }
    }
    async function onExportMultipart(patient, range, sections, letterheadFile) {
        try {
            const fd = new FormData()
            if (patient?.id) fd.append('patient_id', String(patient.id))
            else fd.append('uhid', patient.uhid)

            if (range?.from) fd.append('date_from', range.from)
            if (range?.to) fd.append('date_to', range.to)

            const selected = Object.entries(sections || {})
                .filter(([, v]) => v)
                .map(([k]) => k)
                .join(',')
            if (selected) fd.append('sections', selected)

            fd.append('consent_required', '0')        // ✅ bypass for now
            if (letterheadFile) fd.append('letterhead', letterheadFile)

            const { data: blob } = await exportEmrPdfMultipart(fd)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `EMR_${patient.uhid || patient.id}.pdf`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('PDF exported')
        } catch (err) {
            if (err?.response?.status === 412) {
                toast.error('Consent required for export. Disable consent or capture a consent.')
            } else {
                toast.error('PDF export failed')
            }
        }
    }
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Find Patient</label>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                    className="w-full rounded-xl border border-gray-200 bg-white px-9 py-2 text-sm outline-none ring-blue-200 focus:ring-2"
                    placeholder={placeholder}
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
            </div>

            {/* suggestions */}
            {loading && (
                <div className="text-xs text-gray-500">Searching…</div>
            )}
            {!loading && show.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                    {show.map(p => (
                        <button
                            key={p.uhid}
                            onClick={() => onPick(p)}
                            className="rounded-xl border p-3 text-left transition hover:bg-gray-50"
                        >
                            <div className="font-medium">{p.uhid} — {p.name}</div>
                            <div className="text-xs text-gray-500">
                                {p.gender?.toUpperCase()} {p.dob ? `· ${p.dob}` : ''} {p.phone ? `· ${p.phone}` : ''}
                            </div>
                        </button>
                    ))}
                </div>
            )}
            {!loading && q && show.length === 0 && (
                <div className="text-xs text-gray-500">No matches.</div>
            )}
        </div>
    )
}
