import { useEffect, useState } from 'react'
import API from '../api/client'

export default function PatientRef({ id }) {
    const [t, setT] = useState(null)
    useEffect(() => {
        let ok = true
        const run = async () => {
            if (!id) return
            try {
                const { data } = await API.get(`/patients/${id}`)
                if (!ok) return
                const n = [data.first_name, data.last_name].filter(Boolean).join(' ')
                setT(`${data.uhid || 'UHID'} — ${n || 'Name'}`)
            } catch {
                setT(`#${id}`)
            }
        }
        run(); return () => { ok = false }
    }, [id])
    return <span>{t || '—'}</span>
}
