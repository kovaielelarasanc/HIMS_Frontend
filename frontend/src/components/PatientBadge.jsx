import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import API from '../api/client'

/** Shows UHID — Name. Auto-fetches if only patientId is given. */
export default function PatientBadge({ patient, patientId, className = '' }) {
    const [data, setData] = useState(patient || null)

    useEffect(() => {
        let stop = false
        if (!patient && patientId) {
            ; (async () => {
                try {
                    const { data } = await API.get(`/patients/${patientId}`)
                    if (!stop) setData(data)
                } catch { }
            })()
        }
        return () => {
            stop = true
        }
    }, [patient, patientId])

    const uhid = data?.uhid || '—'
    const name =
        data?.name ||
        (data?.first_name
            ? `${data.first_name} ${data.last_name || ''}`.trim()
            : '—')

    const to = data?.id ? `/patients?focus=${data.id}` : undefined

    const chip = (
        <span
            className={[
                'inline-flex items-center gap-2 rounded-md border px-2 py-0.5 text-xs',
                'bg-gray-50 border-gray-200 text-gray-700',
                'max-w-[18rem]',
                className,
            ].join(' ')}
            title={name !== '—' ? name : undefined}
        >
            <span className="font-medium">{uhid}</span>
            <span className="text-gray-400">—</span>
            <span className="truncate">{name}</span>
        </span>
    )

    return to ? <Link to={to}>{chip}</Link> : chip
}
