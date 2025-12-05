// FILE: frontend/src/components/pickers/PatientPicker.jsx
import { useEffect, useState } from 'react'
import { searchPatients } from '../../api/opd'

/**
 * Reusable Patient picker:
 *
 * Props:
 *   value:          patient_id (number | null)
 *   onChange:       (id: number | null, patient: object | null) => void
 *   label:          field label
 *   initialPatient: patient object (for edit screens)
 *   disabled:       boolean
 */
export default function PatientPicker({
    value,
    onChange,
    label = 'Patient',
    initialPatient = null,
    disabled = false,
}) {
    const [q, setQ] = useState('')
    const [list, setList] = useState([])
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState(initialPatient || null)

    // sync from parent in edit mode
    useEffect(() => {
        if (initialPatient) {
            setSelected(initialPatient)
        }
    }, [initialPatient])

    // search on query
    useEffect(() => {
        let alive = true
        if (!q) {
            setList([])
            return
        }
        setLoading(true)
        searchPatients(q)
            .then((r) => {
                if (!alive) return
                setList(r.data || [])
            })
            .catch(() => {
                if (!alive) return
                setList([])
            })
            .finally(() => {
                if (!alive) return
                setLoading(false)
            })
        return () => {
            alive = false
        }
    }, [q])

    // update selected when value appears in list
    useEffect(() => {
        if (!value) {
            setSelected(null)
            return
        }
        const found = list.find((p) => p.id === value)
        if (found) setSelected(found)
    }, [value, list])

    const choose = (p) => {
        setSelected(p)
        setQ('')
        setList([])
        onChange?.(p.id, p)
    }

    const clearSelection = () => {
        setSelected(null)
        onChange?.(null, null)
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>

            {!selected && (
                <>
                    <input
                        className="input"
                        placeholder="Search by name / UHID / phone"
                        value={q}
                        disabled={disabled}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    {loading && (
                        <div className="text-xs text-slate-500">Searching…</div>
                    )}

                    {list.length > 0 && (
                        <div className="max-h-48 overflow-auto rounded-xl border bg-white text-sm">
                            {list.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => choose(p)}
                                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                                >
                                    <div>
                                        <div className="font-medium">
                                            {p.first_name} {p.last_name}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            UHID: {p.uhid} • {p.phone}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {selected && (
                <div className="flex items-start justify-between gap-3 rounded-xl border bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <div>
                        <div className="font-semibold">
                            {selected.first_name} {selected.last_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                            UHID: {selected.uhid} • {selected.phone}
                        </div>
                    </div>
                    {!disabled && (
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="text-[11px] font-medium text-sky-700 hover:underline"
                        >
                            Change
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
