import { useState } from 'react'
import { usePatients } from '../store/patientStore'

export default function DocumentUpload({ patientId, onUploaded }) {
    const { uploadDoc } = usePatients()
    const [file, setFile] = useState(null)
    const [type, setType] = useState('other')
    const [loading, setLoading] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        if (!file) return
        setLoading(true)
        try {
            const doc = await uploadDoc(patientId, file, type)
            setFile(null)
            onUploaded && onUploaded(doc)
        } finally { setLoading(false) }
    }

    return (
        <form onSubmit={submit} className="flex items-center gap-2">
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
                <option value="aadhaar">Aadhaar</option>
                <option value="consent">Consent</option>
                <option value="other">Other</option>
            </select>
            <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block text-sm" />
            <button className="btn" disabled={!file || loading}>{loading ? 'Uploading...' : 'Upload'}</button>
        </form>
    )
}
